/* eslint-disable @typescript-eslint/no-explicit-any */
import { NotificationRepository } from '@/repositories/notification.repository';
import { emitNotification } from '@/lib/events';
import { prisma } from '@/lib/prisma';

export type NotificationPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type NotificationType = 'SYSTEM' | 'INVENTORY' | 'CONTRACTOR' | 'PROJECT' | 'FINANCE' | 'HELPDESK';

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
        metadata?: any;
    }) {
        try {
            // Check user preferences
            const preference = await NotificationRepository.findPreference(userId, type);

            if (preference && !preference.enabled) {
                return null; // User disabled this type
            }

            // Limit to 50 notifications per user (FIFO)
            const count = await NotificationRepository.count({ userId });
            if (count >= 50) {
                // Find and delete excess notifications
                const excess = await NotificationRepository.findMany({
                    where: { userId },
                    orderBy: { createdAt: 'asc' },
                    take: (count - 50) + 1,
                    select: { id: true }
                });

                if (excess.length > 0) {
                    await NotificationRepository.deleteMany({
                        id: { in: excess.map((n: { id: string }) => n.id) }
                    });
                }
            }

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
        metadata?: any;
    }) {
        try {
            // Check notification counts in bulk using GroupBy
            const counts = await prisma.notification.groupBy({
                by: ['userId'],
                where: { userId: { in: userIds } },
                _count: { _all: true }
            });

            const countMap = new Map<string, number>();
            for (const c of counts) {
                countMap.set(c.userId, c._count._all);
            }

            const usersWithExcess = userIds.filter(userId => (countMap.get(userId) || 0) >= 50);

            if (usersWithExcess.length > 0) {
                for (const userId of usersWithExcess) {
                    const currentCount = countMap.get(userId) || 0;
                    const deleteCount = (currentCount - 50) + 1;
                    const excess = await NotificationRepository.findMany({
                        where: { userId },
                        orderBy: { createdAt: 'asc' },
                        take: deleteCount,
                        select: { id: true }
                    });
                    if (excess.length > 0) {
                        await NotificationRepository.deleteMany({
                            id: { in: excess.map((n: { id: string }) => n.id) }
                        });
                    }
                }
            }

            // Filter userIds based on preferences
            const disabledPreferences = await NotificationRepository.findDisabledPreferences(userIds, type);
            const disabledUserIds = new Set(disabledPreferences.map((p: any) => p.userId));
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
            createdNotifications.forEach((notification: any) => {
                emitNotification(notification.userId, notification);
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
        metadata?: any;
        opmcId?: string;
    }) {
        try {
            const users = await prisma.user.findMany({
                where: {
                    role: { in: roles as any },
                    ...(opmcId ? {
                        OR: [
                            { accessibleOpmcs: { some: { id: opmcId } } },
                            { role: { in: ['SUPER_ADMIN', 'ADMIN'] } } // Admins/SuperAdmins are global
                        ]
                    } : {})
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
     */
    static async delete(id: string) {
        return await NotificationRepository.deleteMany({ id });
    }

    /**
     * Delete all user's notifications
     */
    static async deleteAll(userId: string) {
        return await NotificationRepository.deleteMany({ userId });
    }
}
