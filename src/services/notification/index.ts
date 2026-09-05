import { NotificationRepository } from '@/repositories/notification.repository';
import { emitNotification } from '@/lib/events';
import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';
import { Role } from '@prisma/client';
import { redis } from '@/lib/redis';
import { notificationsQueue } from '@/lib/queue';

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
     * Send notification to all users with specific roles
     */
    static async notifyByRole({
        roles,
        title,
        message,
        type = 'SYSTEM',
        priority = 'MEDIUM',
        link,
        metadata,
        opmcId, // Optional filter by OPMC
        dedupKey  // Business identity: one row per recipient per key, repeats bump groupedCount
    }: {
        roles: string[];
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
            // Fix #8: Strict validation of roles array against Prisma Role enum
            const validRoles = roles.filter((role): role is Role => Object.values(Role).includes(role as Role));
            if (validRoles.length === 0) {
                console.warn('[NotificationService] notifyByRole: No valid roles provided. Skipping.', roles);
                return null;
            }

            // Global executives always receive cross-OPMC alerts
            const globalRoles: Role[] = ['SUPER_ADMIN', 'ADMIN', 'CEO', 'HEAD_OF_OSP'];
            
            // Validate that we only query with roles the caller requested (global or not)
            const globalRolesRequested = globalRoles.filter(r => validRoles.includes(r));
            const scopedRolesRequested = validRoles.filter(r => !globalRoles.includes(r));

            const users = await prisma.user.findMany({
                where: {
                    OR: [
                        // Scoped roles: Must meet OPMC filter if provided
                        {
                            role: { in: scopedRolesRequested },
                            ...(opmcId ? {
                                OR: [
                                    { accessibleOpmcs: { some: { id: opmcId } } },
                                    { assignedStore: { opmcs: { some: { id: opmcId } } } }
                                ]
                            } : {})
                        },
                        // Fix #2: Global roles: Requested global roles bypass the OPMC filter entirely
                        {
                            role: { in: globalRolesRequested }
                        }
                    ]
                },
                select: { id: true }
            });

            if (users.length === 0) return null;

            return await this.broadcast({
                userIds: users.map((u: { id: string }) => u.id),
                title,
                message,
                type,
                priority,
                link,
                metadata,
                dedupKey
            });
        } catch (error) {
            console.error('Failed to notify by role:', error);
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
            take: limit
        });
    }

    /**
     * Mark notification as read
     */
    static async markAsRead(id: string) {
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
     * Accepts optional pre-fetched role/storeId to avoid a redundant DB lookup
     * when the caller (API route) already has these values from auth headers.
     */
    static async getSidebarCounts(userId: string, preloadedRole?: string, preloadedStoreId?: string | null) {
        let userRole = preloadedRole || '';
        let assignedStoreId = preloadedStoreId !== undefined ? preloadedStoreId : null;

        // Only hit DB if we don't have the role pre-loaded
        if (!userRole) {
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { role: true, assignedStoreId: true }
            });
            userRole = String(user?.role || '');
            assignedStoreId = user?.assignedStoreId ?? null;
        }

        // Real actionable database pending count for material requests & approvals
        let dbMaterialPending = 0;
        if (['SUPER_ADMIN', 'ADMIN', 'CEO', 'HEAD_OF_OSP', 'OSP_MANAGER', 'PROCUREMENT_OFFICER', 'HEAD_OF_PROCUREMENT', 'STORES_MANAGER', 'STORES_ASSISTANT', 'AREA_MANAGER'].includes(userRole)) {
            if (['OSP_MANAGER', 'HEAD_OF_OSP', 'PROCUREMENT_OFFICER', 'HEAD_OF_PROCUREMENT'].includes(userRole)) {
                dbMaterialPending = await prisma.stockRequest.count({
                    where: { status: 'PENDING', workflowStage: { in: ['OSP_MANAGER_APPROVAL', 'PROCUREMENT'] } }
                });
            } else if (userRole === 'AREA_MANAGER') {
                dbMaterialPending = await prisma.stockRequest.count({
                    where: { status: 'PENDING', workflowStage: 'ARM_APPROVAL' }
                });
            } else if (['STORES_MANAGER', 'STORES_ASSISTANT'].includes(userRole)) {
                if (assignedStoreId) {
                    dbMaterialPending = await prisma.stockRequest.count({
                        where: {
                            OR: [
                                { fromStoreId: assignedStoreId, workflowStage: { in: ['STORES_MANAGER_APPROVAL', 'MAIN_STORE_RELEASE', 'PARTIALLY_ISSUED'] } },
                                { toStoreId: assignedStoreId, workflowStage: { in: ['RECEIVE_PENDING', 'DISPATCHED', 'SUB_STORE_RECEIVE', 'GRN_PENDING'] } }
                            ]
                        }
                    });
                } else {
                    dbMaterialPending = await prisma.stockRequest.count({
                        where: { workflowStage: { in: ['STORES_MANAGER_APPROVAL', 'MAIN_STORE_RELEASE', 'RECEIVE_PENDING', 'GRN_PENDING'] } }
                    });
                }
            } else {
                dbMaterialPending = await prisma.stockRequest.count({
                    where: { status: 'PENDING', workflowStage: { notIn: ['COMPLETED', 'REJECTED'] } }
                });
            }
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
