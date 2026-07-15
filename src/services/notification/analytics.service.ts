/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Notification Analytics Service
 * Tracks notification delivery, read rates, and user engagement.
 * Provides data for optimizing notification relevance and timing.
 */

import { prisma } from '@/lib/prisma';

export interface NotificationAnalytics {
    period: string;
    totalSent: number;
    totalDelivered: number;
    totalRead: number;
    readRate: number;
    avgReadTimeMinutes: number;
    byType: Record<string, { sent: number; read: number; readRate: number }>;
    byPriority: Record<string, { sent: number; read: number; readRate: number }>;
    topUsers: Array<{ userId: string; count: number; readRate: number }>;
}

export class NotificationAnalyticsService {

    /**
     * Get analytics for a specific time period
     */
    static async getAnalytics(period: '24h' | '7d' | '30d' | 'all'): Promise<NotificationAnalytics> {
        const since = this.getSinceDate(period);

        const whereClause = since ? { createdAt: { gte: since } } : {};

        // Aggregated queries
        const [stats] = await Promise.all([
            prisma.notification.aggregate({
                _count: { id: true },
                where: whereClause,
            }),
        ]);

        // By type breakdown
        const byTypeRaw = await prisma.notification.groupBy({
            by: ['type'],
            where: whereClause,
            _count: { id: true },
        });

        const byTypeRead = await prisma.notification.groupBy({
            by: ['type'],
            where: { ...whereClause, isRead: true },
            _count: { id: true },
        });

        // By priority breakdown
        const byPriorityRaw = await prisma.notification.groupBy({
            by: ['priority'],
            where: whereClause,
            _count: { id: true },
        });

        const byPriorityRead = await prisma.notification.groupBy({
            by: ['priority'],
            where: { ...whereClause, isRead: true },
            _count: { id: true },
        });

        // Top users by notification count
        const topUsers = await prisma.notification.groupBy({
            by: ['userId'],
            where: whereClause,
            _count: { id: true },
            orderBy: { _count: { id: 'desc' } },
            take: 10,
        });

        const totalSent = stats._count.id;
        const totalRead = byTypeRead.reduce((sum, g) => sum + g._count.id, 0);
        const readRate = totalSent > 0 ? (totalRead / totalSent) * 100 : 0;

        // Build byType map with read rates
        const byType: Record<string, any> = {};
        for (const g of byTypeRaw) {
            const readCount = byTypeRead.find(r => r.type === g.type)?._count.id || 0;
            byType[g.type] = {
                sent: g._count.id,
                read: readCount,
                readRate: g._count.id > 0 ? (readCount / g._count.id) * 100 : 0,
            };
        }

        // Build byPriority map with read rates
        const byPriority: Record<string, any> = {};
        for (const g of byPriorityRaw) {
            const readCount = byPriorityRead.find(r => r.priority === g.priority)?._count.id || 0;
            byPriority[g.priority] = {
                sent: g._count.id,
                read: readCount,
                readRate: g._count.id > 0 ? (readCount / g._count.id) * 100 : 0,
            };
        }

        // Estimate average read time (simplified)
        const readNotifications = await prisma.notification.findMany({
            where: { ...whereClause, isRead: true },
            select: { createdAt: true, updatedAt: true },
            take: 1000,
        });

        let avgReadTimeMinutes = 0;
        if (readNotifications.length > 0) {
            const totalReadTimeMs = readNotifications.reduce((sum, n) => {
                const readTime = new Date(n.updatedAt).getTime() - new Date(n.createdAt).getTime();
                return sum + (readTime > 0 ? readTime : 0);
            }, 0);
            avgReadTimeMinutes = totalReadTimeMs / readNotifications.length / 60000;
        }

        return {
            period,
            totalSent,
            totalDelivered: totalSent, // Simplified - assumes all created = delivered
            totalRead,
            readRate: Math.round(readRate * 100) / 100,
            avgReadTimeMinutes: Math.round(avgReadTimeMinutes * 100) / 100,
            byType,
            byPriority,
            topUsers: topUsers.map(u => ({
                userId: u.userId,
                count: u._count.id,
                readRate: 0, // Would need per-user read count query
            })),
        };
    }

    /**
     * Get user-level notification statistics
     */
    static async getUserStats(userId: string): Promise<{
        totalReceived: number;
        totalRead: number;
        readRate: number;
        unreadCount: number;
        criticalUnreadCount: number;
        byType: Record<string, { received: number; read: number; readRate: number }>;
    }> {
        const [totalReceived, totalRead, unreadCount, criticalUnreadCount] = await Promise.all([
            prisma.notification.count({ where: { userId } }),
            prisma.notification.count({ where: { userId, isRead: true } }),
            prisma.notification.count({ where: { userId, isRead: false } }),
            prisma.notification.count({ where: { userId, isRead: false, priority: 'CRITICAL' } }),
        ]);

        const byTypeRaw = await prisma.notification.groupBy({
            by: ['type'],
            where: { userId },
            _count: { id: true },
        });

        const byTypeRead = await prisma.notification.groupBy({
            by: ['type'],
            where: { userId, isRead: true },
            _count: { id: true },
        });

        const byType: Record<string, any> = {};
        for (const g of byTypeRaw) {
            const readCount = byTypeRead.find(r => r.type === g.type)?._count.id || 0;
            byType[g.type] = {
                received: g._count.id,
                read: readCount,
                readRate: g._count.id > 0 ? (readCount / g._count.id) * 100 : 0,
            };
        }

        return {
            totalReceived,
            totalRead,
            readRate: totalReceived > 0 ? (totalRead / totalReceived) * 100 : 0,
            unreadCount,
            criticalUnreadCount,
            byType,
        };
    }

    /**
     * Get delivery performance metrics
     */
    static async getDeliveryMetrics(): Promise<{
        avgCreationToDeliveryMs: number;
        totalEventsEmitted: number;
        sseActiveConnections: number;
    }> {
        // Simplified metrics - in production, track these in Redis
        return {
            avgCreationToDeliveryMs: 0,
            totalEventsEmitted: 0,
            sseActiveConnections: 0,
        };
    }

    private static getSinceDate(period: string): Date | null {
        const now = new Date();
        switch (period) {
            case '24h':
                return new Date(now.getTime() - 24 * 60 * 60 * 1000);
            case '7d':
                return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            case '30d':
                return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            default:
                return null;
        }
    }
}