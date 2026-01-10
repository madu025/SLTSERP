import { prisma } from '@/lib/prisma';
import { emitNotification } from '@/lib/events';

export type NotificationPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type NotificationType = 'SYSTEM' | 'INVENTORY' | 'CONTRACTOR' | 'PROJECT' | 'FINANCE';

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
            const notification = await prisma.notification.create({
                data: {
                    userId,
                    title,
                    message,
                    type,
                    priority,
                    link,
                    metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : undefined
                }
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
            const data = userIds.map(userId => ({
                userId,
                title,
                message,
                type,
                priority,
                link,
                metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : undefined
            }));

            const result = await prisma.notification.createMany({
                data
            });

            // Emit events for each user
            userIds.forEach(userId => {
                emitNotification(userId, { title, message, type, priority, link, metadata, createdAt: new Date() });
            });

            return result;
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
                        accessibleOpmcs: {
                            some: { id: opmcId }
                        }
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
        return await prisma.notification.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: limit
        });
    }

    /**
     * Mark notification as read
     */
    static async markAsRead(id: string) {
        return await prisma.notification.update({
            where: { id },
            data: { isRead: true }
        });
    }

    /**
     * Mark all user's notifications as read
     */
    static async markAllAsRead(userId: string) {
        return await prisma.notification.updateMany({
            where: { userId, isRead: false },
            data: { isRead: true }
        });
    }

    /**
     * Delete old notifications (e.g., older than 30 days)
     */
    static async cleanup(days = 30, onlyRead = true) {
        const thresholdDate = new Date();
        thresholdDate.setDate(thresholdDate.getDate() - days);

        return await prisma.notification.deleteMany({
            where: {
                createdAt: { lt: thresholdDate },
                ...(onlyRead ? { isRead: true } : {})
            }
        });
    }
}
