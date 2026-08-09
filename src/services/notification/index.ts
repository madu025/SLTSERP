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
     * Create a new notification for a user
     */
    static async send({
        userId,
        title,
        message,
        type = 'SYSTEM',
        priority = 'MEDIUM',
        link,
        metadata
    }: {
        userId: string;
        title: string;
        message: string;
        type?: NotificationType;
        priority?: NotificationPriority;
        link?: string;
        metadata?: Record<string, unknown>;
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

            const notification = await NotificationRepository.create({
                userId,
                title,
                message,
                type,
                priority,
                link,
                metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : undefined
            });

            if (notification) {
                emitNotification(userId, notification);
                
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
        metadata
    }: {
        userIds: string[];
        title: string;
        message: string;
        type?: NotificationType;
        priority?: NotificationPriority;
        link?: string;
        metadata?: Record<string, unknown>;
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
        opmcId // Optional filter by OPMC
    }: {
        roles: string[];
        title: string;
        message: string;
        type?: NotificationType;
        priority?: NotificationPriority;
        link?: string;
        metadata?: Record<string, unknown>;
        opmcId?: string;
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
                metadata
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
     * Delete old notifications (e.g., older than 30 days)
     */
    static async cleanup(days = 30, onlyRead = true) {
        const thresholdDate = new Date();
        thresholdDate.setDate(thresholdDate.getDate() - days);

        return await NotificationRepository.deleteMany({
            createdAt: { lt: thresholdDate },
            ...(onlyRead ? { isRead: true } : {})
        });
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

        // Fix #4: Use exact grouped counting in DB instead of `take: 100` loop
        const [
            approvalsCount,
            helpdeskCount,
            procurementApprovalsCount,
            contractorApprovalsCount,
            materialApprovalsCount,
            serviceOrdersCount
        ] = await Promise.all([
            prisma.notification.count({ where: { userId, isRead: false, link: { startsWith: '/projects' } } }),
            prisma.notification.count({ where: { userId, isRead: false, link: { startsWith: '/helpdesk' } } }),
            prisma.notification.count({ where: { userId, isRead: false, link: { startsWith: '/admin/inventory' } } }),
            prisma.notification.count({ where: { userId, isRead: false, link: { startsWith: '/admin/contractors' } } }),
            prisma.notification.count({ where: { userId, isRead: false, link: { startsWith: '/inventory/approvals' } } }),
            prisma.notification.count({ where: { userId, isRead: false, link: { startsWith: '/service-orders' } } })
        ]);

        return {
            approvals: approvalsCount,
            helpdesk: helpdeskCount,
            // Fallback to real DB material requests if specific notification counts are lower (or we just use the real DB count)
            serviceOrders: serviceOrdersCount,
            procurementApprovals: procurementApprovalsCount,
            contractorApprovals: contractorApprovalsCount,
            materialRequests: dbMaterialPending,
            materialApprovals: materialApprovalsCount
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
