import { NotificationRepository } from '@/repositories/notification.repository';
import { emitNotification } from '@/lib/events';
import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';
import { Prisma } from '@prisma/client';
import { redis } from '@/lib/redis';
import { notificationsQueue } from '@/lib/queue';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { getUserEffectivePermissions } from '@/lib/user-permissions';
import { NIL_UUID, resolveOpmcScope } from '@/lib/opmc-scope';
import { StoreService } from '@/services/inventory/store.service';
import { parsePermissionList } from '@/lib/effective-permissions';
import { NOTIFICATION_AUDIENCES, type NotificationAudienceId } from './notification-audiences';

export type NotificationPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type NotificationType = 'SYSTEM' | 'INVENTORY' | 'CONTRACTOR' | 'PROJECT' | 'FINANCE' | 'HELPDESK';

// Utility to create a deterministic hash from strings for deduplication fallback
const getDedupHash = (title: string, message: string) => {
    let hash = 0;
    const str = title + message;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
};

export class NotificationService {
    /**
     * Create a new notification for a user.
     * By default uses category-based upsert: if an unread notification with the
     * same userId + type + link exists, it is replaced in-place (groupedCount++).
     * Set replaceByCategory: false to always insert a new row.
     * Pass dedupKey to pin the row to a business identity instead (one row per user per key,
     * repeats only bump groupedCount) - that wins over the category replacement.
     */
    static async send({
        userId,
        title,
        message,
        type = 'SYSTEM',
        priority = 'MEDIUM',
        link,
        metadata,
        replaceByCategory = true,
        dedupKey
    }: {
        userId: string;
        title: string;
        message: string;
        type?: NotificationType;
        priority?: NotificationPriority;
        link?: string;
        metadata?: Record<string, unknown>;
        replaceByCategory?: boolean;
        dedupKey?: string;
    }) {
        try {
            // Check user preferences
            const preference = await NotificationRepository.findPreference(userId, type);

            if (preference && !preference.enabled) {
                return null; // User disabled this type
            }

            // Anti-spam: skip if identical notification for the SAME entity exists within last 5 minutes
            // Fix #3: Use hash of content as fallback instead of Date.now() which defeats deduplication
            const entityId = metadata?.requestId || metadata?.contractorId || metadata?.serviceOrderId || metadata?.id || getDedupHash(title, message);
            const dedupeKey = `notif_dedupe:${userId}:${title}:${link || 'nolink'}:${entityId}`;
            
            // Fix #7: ioredis set with 'NX' returns 'OK' on success, null if key already exists
            const isNew = await redis.set(dedupeKey, '1', 'EX', 300, 'NX').catch(() => 'OK'); // Fallback if Redis offline
            if (isNew !== 'OK') {
                return null; // Deduplicated by Redis O(1) cache
            }

            // Fix #6: Offload FIFO cleanup to background worker to prevent race conditions and DB stalls on API thread
            notificationsQueue.add('cleanup-fifo', { userId }, { removeOnComplete: true, removeOnFail: 5 }).catch(() => {});

            // Category-based upsert: replace existing unread notification in same category
            // instead of accumulating duplicate rows (reduces egress + table bloat)
            let notification;
            let reasserted = false;
            if (dedupKey) {
                const result = await NotificationRepository.upsertByDedupKey(userId, dedupKey, {
                    title,
                    message,
                    type,
                    priority,
                    link,
                    metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : undefined
                });
                notification = result.notification;
                reasserted = result.replaced;
            } else if (replaceByCategory) {
                const result = await NotificationRepository.replaceUnreadByCategory(
                    userId,
                    type,
                    link,
                    {
                        title,
                        message,
                        priority,
                        metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : undefined
                    }
                );
                notification = result.notification;
            } else {
                notification = await NotificationRepository.create({
                    userId,
                    title,
                    message,
                    type,
                    priority,
                    link,
                    metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : undefined
                });
            }

            if (notification) {
                emitNotification(userId, notification);

                // A deduped repeat has already been delivered the first time it was inserted; do
                // not re-push/re-email the same business event to the recipient.
                if (reasserted) return notification;

                // Offload heavy processing (Push/Email) to BullMQ Background Worker
                await notificationsQueue.add('process-notification', {
                    notificationId: notification.id,
                    userId,
                    title,
                    message,
                    type,
                    link
                }, {
                    removeOnComplete: true,
                    removeOnFail: 10 // keep last 10 failed jobs
                }).catch(err => {
                    console.error('[BULLMQ-ERROR] Failed to enqueue notification job:', err);
                });
            }

            return notification;
        } catch (error) {
            console.error('Failed to create notification:', error);
            // Non-blocking error - system should continue even if notification fails
            return null;
        }
    }

    /**
     * Send notification to multiple users (e.g., all admins)
     */
    static async broadcast({
        userIds,
        title,
        message,
        type = 'SYSTEM',
        priority = 'MEDIUM',
        link,
        metadata,
        dedupKey
    }: {
        userIds: string[];
        title: string;
        message: string;
        type?: NotificationType;
        priority?: NotificationPriority;
        link?: string;
        metadata?: Record<string, unknown>;
        dedupKey?: string;
    }) {
        try {
            // Fix #5: Offload FIFO cleanup to background worker for all users in the broadcast
            for (const userId of userIds) {
                notificationsQueue.add('cleanup-fifo', { userId }, { removeOnComplete: true, removeOnFail: 5 }).catch(() => {});
            }

            // Filter userIds based on preferences
            const disabledPreferences = await NotificationRepository.findDisabledPreferences(userIds, type);
            const disabledUserIds = new Set(disabledPreferences.map((p: { userId: string }) => p.userId));
            const filteredUserIds = userIds.filter(id => !disabledUserIds.has(id));

            if (filteredUserIds.length === 0) return { count: 0 };

            const data = filteredUserIds.map(userId => ({
                userId,
                title,
                message,
                type,
                priority,
                link,
                metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : undefined
            }));

            if (dedupKey) {
                // One row per (user, key): a repeat of the same business event bumps groupedCount
                // instead of inserting, and only the first insert is pushed/emailed.
                const results = await Promise.all(filteredUserIds.map(userId =>
                    NotificationRepository.upsertByDedupKey(userId, dedupKey, {
                        title,
                        message,
                        type,
                        priority,
                        link,
                        metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : undefined
                    })
                ));

                results.forEach(({ notification, replaced }) => {
                    emitNotification(notification.userId, notification);
                    if (replaced) return;
                    notificationsQueue.add('process-notification', {
                        notificationId: notification.id,
                        userId: notification.userId,
                        title,
                        message,
                        type,
                        link
                    }, { removeOnComplete: true, removeOnFail: 10 }).catch(() => {});
                });

                return { count: results.length };
            }

            const createdNotifications = await NotificationRepository.createManyAndReturn(data);

            // Emit events for each user with the full database object (including id)
            createdNotifications.forEach((notification: { id: string; userId: string; [key: string]: unknown }) => {
                emitNotification(notification.userId, notification);
                
                // Add to BullMQ for async push/email distribution
                notificationsQueue.add('process-notification', {
                    notificationId: notification.id,
                    userId: notification.userId,
                    title,
                    message,
                    type,
                    link
                }, { removeOnComplete: true, removeOnFail: 10 }).catch(() => {});
            });

            return { count: createdNotifications.length };
        } catch (error) {
            console.error('Failed to broadcast notifications:', error);
            return null;
        }
    }

    /**
     * Resolve active, capability-backed recipients for a notification
     * audience. Explicit User.permissions values replace inherited role
     * grants, including an explicit empty list. OPMC filtering is preserved:
     * users with the canonical global notification capability bypass the
     * supplied OPMC, while all other recipients need an accessible OPMC or a
     * store assigned to that OPMC.
     */
    static async getAudienceRecipients({
        audience,
        opmcId,
    }: {
        audience: NotificationAudienceId;
        opmcId?: string;
    }): Promise<Array<{ id: string; email: string | null }>> {
        const audiencePermission = NOTIFICATION_AUDIENCES[audience]?.permission;
        if (!audiencePermission) return [];

        const requiredCodes = [audiencePermission, RBAC_PERMISSIONS.NOTIFICATION_GLOBAL];
        const activeDefinitions = await prisma.permissionDefinition.findMany({
            where: { code: { in: requiredCodes }, isActive: true },
            select: { code: true },
        });
        const activeCodes = new Set(activeDefinitions.map((definition) => definition.code));
        if (!activeCodes.has(audiencePermission)) return [];

        const users = await prisma.user.findMany({
            where: {
                status: 'active',
                OR: [
                    // Explicit overrides cannot be filtered by a relational
                    // grant, so they are parsed and checked below.
                    { permissions: { not: null } },
                    {
                        systemRole: {
                            isActive: true,
                            rolePermissions: {
                                some: {
                                    permissionDefinition: {
                                        code: audiencePermission,
                                        isActive: true,
                                    },
                                },
                            },
                        },
                    },
                    {
                        sectionAssignments: {
                            some: {
                                role: {
                                    isActive: true,
                                    rolePermissions: {
                                        some: {
                                            permissionDefinition: {
                                                code: audiencePermission,
                                                isActive: true,
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                ],
            },
            select: {
                id: true,
                email: true,
                permissions: true,
                accessibleOpmcs: { select: { id: true } },
                assignedStore: { select: { opmcs: { select: { id: true } } } },
                systemRole: {
                    select: {
                        isActive: true,
                        rolePermissions: {
                            where: { permissionDefinition: { code: { in: requiredCodes }, isActive: true } },
                            select: { permissionDefinition: { select: { code: true } } },
                        },
                    },
                },
                sectionAssignments: {
                    select: {
                        role: {
                            select: {
                                isActive: true,
                                rolePermissions: {
                                    where: { permissionDefinition: { code: { in: requiredCodes }, isActive: true } },
                                    select: { permissionDefinition: { select: { code: true } } },
                                },
                            },
                        },
                    },
                },
            },
        });

        return users.filter((user) => {
            const directOverride = user.permissions !== null && user.permissions !== undefined;
            const directPermissions = directOverride ? new Set(parsePermissionList(user.permissions)) : null;
            const inheritedPermissions = new Set<string>();

            if (!directOverride) {
                if (user.systemRole?.isActive) {
                    user.systemRole.rolePermissions.forEach((grant) => {
                        if (grant.permissionDefinition?.code) inheritedPermissions.add(grant.permissionDefinition.code);
                    });
                }
                user.sectionAssignments.forEach((assignment) => {
                    if (!assignment.role?.isActive) return;
                    assignment.role.rolePermissions.forEach((grant) => {
                        if (grant.permissionDefinition?.code) inheritedPermissions.add(grant.permissionDefinition.code);
                    });
                });
            }

            const effectivePermissions = directPermissions ?? inheritedPermissions;
            if (!effectivePermissions.has(audiencePermission)) return false;
            if (!opmcId) return true;
            if (activeCodes.has(RBAC_PERMISSIONS.NOTIFICATION_GLOBAL) && effectivePermissions.has(RBAC_PERMISSIONS.NOTIFICATION_GLOBAL)) {
                return true;
            }

            return user.accessibleOpmcs.some((opmc) => opmc.id === opmcId)
                || user.assignedStore?.opmcs.some((opmc) => opmc.id === opmcId) === true;
        });
    }

    static async getAudienceEmails({ audience, opmcId }: { audience: NotificationAudienceId; opmcId?: string }) {
        const recipients = await this.getAudienceRecipients({ audience, opmcId });
        return recipients.map((recipient) => recipient.email).filter((email): email is string => Boolean(email));
    }

    /**
     * Send notification to a canonical capability-backed audience.
     * The broadcast path is unchanged, so preference filtering, Redis
     * deduplication, grouped rows, SSE emission, and BullMQ delivery remain
     * identical to the previous role-based implementation.
     */
    static async notifyByAudience({
        audience,
        title,
        message,
        type = 'SYSTEM',
        priority = 'MEDIUM',
        link,
        metadata,
        opmcId, // Optional filter by OPMC
        dedupKey  // Business identity: one row per recipient per key, repeats bump groupedCount
    }: {
        audience: NotificationAudienceId;
        title: string;
        message: string;
        type?: NotificationType;
        priority?: NotificationPriority;
        link?: string;
        metadata?: Record<string, unknown>;
        opmcId?: string;
        dedupKey?: string;
    }) {
        try {
            const users = await this.getAudienceRecipients({ audience, opmcId });
            if (users.length === 0) return null;

            return await this.broadcast({
                userIds: users.map((u) => u.id),
                title,
                message,
                type,
                priority,
                link,
                metadata,
                dedupKey
            });
        } catch (error) {
            console.error('Failed to notify by audience:', error);
            return null;
        }
    }

    /**
     * Get user's notifications
     */
    static async getUserNotifications(userId: string, limit = 50) {
        return await NotificationRepository.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: limit,
            select: {
                id: true,
                type: true,
                title: true,
                message: true,
                priority: true,
                link: true,
                isRead: true,
                createdAt: true,
                groupedCount: true
            }
        });
    }

    /**
     * Mark notification as read
     */
    static async markAsRead(id: string, userId?: string) {
        if (userId) {
            return await NotificationRepository.updateMany({ id, userId }, { isRead: true });
        }
        return await NotificationRepository.update(id, { isRead: true });
    }

    /**
     * Mark all user's notifications as read
     */
    static async markAllAsRead(userId: string) {
        return await NotificationRepository.updateMany({ userId, isRead: false }, { isRead: true });
    }

    /**
     * Mark specific link notifications as read for a user
     */
    static async markLinkAsRead(userId: string, link: string, opmcId?: string | null) {
        if (opmcId && opmcId !== 'ALL') {
            return await NotificationRepository.updateMany({
                userId,
                link,
                isRead: false,
                metadata: {
                    path: ['opmcId'],
                    equals: opmcId
                }
            }, { isRead: true });
        }
        return await NotificationRepository.updateMany({ userId, link, isRead: false }, { isRead: true });
    }

    /**
     * Mark notifications matching linkPrefix as read for a user
     */
    static async markLinkPrefixAsRead(userId: string, linkPrefix: string) {
        return await NotificationRepository.updateMany({
            userId,
            link: { startsWith: linkPrefix },
            isRead: false
        }, { isRead: true });
    }

    /**
     * Mark specific type notifications as read for a user
     */
    static async markTypeAsRead(userId: string, type: string) {
        return await NotificationRepository.updateMany({ userId, type, isRead: false }, { isRead: true });
    }

    /**
     * Retention sweep (weekly, NOTIFICATION_CLEANUP).
     *
     * Three rules, all bounded by the same age cutoff:
     *  - read rows older than `days` (the historical behaviour);
     *  - any row whose `expiresAt` is more than `days` in the past - an alert past its own lifetime
     *    is dead regardless of read state, and unread-but-expired rows were never collectable;
     *  - superseded duplicates of a dedup key, keeping the newest row per (user, key).
     */
    static async cleanup(days = 30, onlyRead = true) {
        const thresholdDate = new Date();
        thresholdDate.setDate(thresholdDate.getDate() - days);

        const stale = await NotificationRepository.deleteMany({
            createdAt: { lt: thresholdDate },
            ...(onlyRead ? { isRead: true } : {})
        });

        // expiresAt is set by the producer, so it can be in the future; only delete once the
        // notification is past its lifetime by the full retention window.
        const expired = await NotificationRepository.deleteMany({
            expiresAt: { lt: thresholdDate }
        });

        const superseded = await NotificationRepository.deleteSupersededByDedupKey();

        const count = stale.count + expired.count + superseded;
        if (expired.count > 0 || superseded > 0) {
            console.log(`[NotificationService] cleanup: ${stale.count} read, ${expired.count} expired, ${superseded} superseded dedup row(s) removed.`);
        }
        return { count, read: stale.count, expired: expired.count, superseded };
    }

    /**
     * Delete a single notification
     * Fix #1: Added ownership check to prevent IDOR vulnerability
     */
    static async delete(id: string, userId: string) {
        return await NotificationRepository.deleteMany({ id, userId });
    }

    /**
     * Delete all user's notifications
     */
    static async deleteAll(userId: string) {
        return await NotificationRepository.deleteMany({ userId });
    }

    /**
     * Get aggregated sidebar notification counts in memory.
     * Workflow stage selection is resolved from the server-side user record;
     * callers cannot override the role or store identity through headers.
     */
    static async getSidebarCounts(userId: string) {
        // Real actionable database pending count for material requests & approvals
        let dbMaterialPending = 0;
        const permissions = await getUserEffectivePermissions(userId);
        const canApproveInventory = permissions.includes(RBAC_PERMISSIONS.INVENTORY_APPROVE);
        const canWriteInventory = permissions.includes(RBAC_PERMISSIONS.INVENTORY_WRITE);
        const canWriteProcurement = permissions.includes(RBAC_PERMISSIONS.PROCUREMENT_WRITE);
        const isGlobal = (await resolveOpmcScope(userId)) === undefined;
        const accessibleStoreIds = isGlobal
            ? undefined
            : (await StoreService.getAccessibleStores(userId)).map((store) => store.id);
        const storeScope: Prisma.StockRequestWhereInput = accessibleStoreIds === undefined
            ? {}
            : {
                OR: [
                    { fromStoreId: { in: accessibleStoreIds.length > 0 ? accessibleStoreIds : [NIL_UUID] } },
                    { toStoreId: { in: accessibleStoreIds.length > 0 ? accessibleStoreIds : [NIL_UUID] } },
                ],
            };

        if (canApproveInventory || canWriteInventory || canWriteProcurement) {
            const approvalStages = ['ARM_APPROVAL', 'OSP_MANAGER_APPROVAL', 'STORES_MANAGER_APPROVAL'];
            const storeStages = ['MAIN_STORE_RELEASE', 'PARTIALLY_ISSUED', 'RECEIVE_PENDING', 'DISPATCHED', 'SUB_STORE_RECEIVE', 'GRN_PENDING'];
            const procurementStages = ['PROCUREMENT', 'PROCUREMENT_PROCESSING'];
            const stages = isGlobal
                ? undefined
                : [...new Set([
                    ...(canApproveInventory ? approvalStages : []),
                    ...(canWriteInventory ? storeStages : []),
                    ...(canWriteProcurement ? procurementStages : []),
                ])];
            dbMaterialPending = await prisma.stockRequest.count({
                where: {
                    ...storeScope,
                    status: 'PENDING',
                    ...(stages && stages.length > 0
                        ? { workflowStage: { in: stages } }
                        : { workflowStage: { notIn: ['COMPLETED', 'REJECTED'] } }),
                },
            });
        }

        // Fix #4: Single grouped count query instead of 6 separate LIKE queries (820s → ~10ms)
        const groupedCounts = await prisma.$queryRawUnsafe<{
            approvals: number; helpdesk: number; procurement: number;
            contractors: number; material: number; serviceOrders: number;
        }[]>(`
            SELECT
                COUNT(*) FILTER (WHERE link LIKE '/projects%')::int          AS "approvals",
                COUNT(*) FILTER (WHERE link LIKE '/helpdesk%')::int          AS "helpdesk",
                COUNT(*) FILTER (WHERE link LIKE '/admin/inventory%')::int   AS "procurement",
                COUNT(*) FILTER (WHERE link LIKE '/admin/contractors%')::int AS "contractors",
                COUNT(*) FILTER (WHERE link LIKE '/inventory/approvals%')::int AS "material",
                COUNT(*) FILTER (WHERE link LIKE '/service-orders%')::int    AS "serviceOrders"
            FROM "Notification"
            WHERE "userId" = $1::uuid AND "isRead" = false
        `, userId);

        const counts = groupedCounts[0] || { approvals: 0, helpdesk: 0, procurement: 0, contractors: 0, material: 0, serviceOrders: 0 };

        return {
            approvals: counts.approvals,
            helpdesk: counts.helpdesk,
            serviceOrders: counts.serviceOrders,
            procurementApprovals: counts.procurement,
            contractorApprovals: counts.contractors,
            materialRequests: dbMaterialPending,
            materialApprovals: counts.material
        };
    }

    /**
     * Get notification preferences for a user
     */
    static async getUserPreferences(userId: string) {
        return prisma.notificationPreference.findMany({
            where: { userId }
        });
    }

    /**
     * Upsert a notification preference for a user
     */
    static async upsertUserPreference(userId: string, type: string, enabled: boolean) {
        return prisma.notificationPreference.upsert({
            where: {
                userId_type: {
                    userId,
                    type
                }
            },
            update: { enabled },
            create: {
                userId,
                type,
                enabled
            }
        });
    }

    /**
     * Send a test notification (useful for debugging/testing)
     */
    static async sendTestNotification(userId: string | null) {
        let targetUserId = userId;
        
        if (!targetUserId) {
            const firstUser = await prisma.user.findFirst({ select: { id: true } });
            if (firstUser) {
                targetUserId = firstUser.id;
            }
        }

        if (!targetUserId) {
            throw AppError.notFound('No user found in the database to receive the test notification');
        }

        return this.send({
            userId: targetUserId,
            title: "🔔 Test Notification Successful",
            message: `This is a test notification generated at ${new Date().toLocaleTimeString()} to verify the real-time notification bell, sound, and browser push alerts!`,
            type: 'SYSTEM',
            priority: 'HIGH',
            link: '/service-orders'
        });
    }

    /**
     * Mark multiple notifications as read for a user
     */
    static async markBulkAsRead(userId: string, notificationIds: string[]) {
        const result = await prisma.notification.updateMany({
            where: {
                id: { in: notificationIds },
                userId
            },
            data: {
                isRead: true
            }
        });

        const remainingUnread = await prisma.notification.count({
            where: {
                userId,
                isRead: false
            }
        });

        try {
            await redis.set(`unread:${userId}`, remainingUnread.toString());
        } catch (err) {
            console.error('Failed to sync Redis unread counter:', err);
        }

        return {
            updatedCount: result.count,
            unreadCount: remainingUnread
        };
    }
}
