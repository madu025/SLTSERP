import { prisma } from '@/lib/prisma';
import { safe } from '@/utils/safe-await.util';

export interface SystemEvent {
    userId: string;
    action: string;
    entity: string;
    entityId: string;
    oldValue?: unknown;
    newValue?: unknown;
    ipAddress?: string;
    userAgent?: string;
    // Notification options
    notify?: boolean;
    notifyTitle?: string;
    notifyMessage?: string;
    notifyType?: 'SYSTEM' | 'INVENTORY' | 'CONTRACTOR' | 'PROJECT' | 'FINANCE';
    notifyPriority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    notifyLink?: string;
}

export class SystemService {
    /**
     * Unified method to log an audit event and optionally send a notification.
     * Use this to avoid duplicating logic across different API routes.
     */
    static async logEvent(event: SystemEvent) {
        const [error, auditLog] = await safe(prisma.$transaction(async (tx) => {
            // 1. Create Audit Log
            const log = await tx.auditLog.create({
                data: {
                    userId: event.userId,
                    action: event.action,
                    entity: event.entity,
                    entityId: event.entityId,
                    oldValue: event.oldValue ? JSON.parse(JSON.stringify(event.oldValue)) : undefined,
                    newValue: event.newValue ? JSON.parse(JSON.stringify(event.newValue)) : undefined,
                    ipAddress: event.ipAddress,
                    userAgent: event.userAgent,
                }
            });

            // 2. Create Notification if requested
            if (event.notify && event.notifyTitle && event.notifyMessage) {
                await tx.notification.create({
                    data: {
                        userId: event.userId,
                        title: event.notifyTitle,
                        message: event.notifyMessage,
                        type: event.notifyType || 'SYSTEM',
                        priority: event.notifyPriority || 'MEDIUM',
                        link: event.notifyLink,
                    }
                });
            }

            return log;
        }));

        if (error) {
            console.error('Failed to log system event:', error);
        }

        return auditLog;
    }

    /**
     * Mark that a user must change their password on next login.
     */
    static async forcePasswordChange(userId: string) {
        return await prisma.user.update({
            where: { id: userId },
            data: { mustChangePassword: true }
        });
    }

    /**
     * Get recent audit logs for administration.
     */
    static async getRecentAuditLogs(limit = 100) {
        return await prisma.auditLog.findMany({
            take: limit,
            orderBy: { createdAt: 'desc' },
            include: { user: { select: { name: true, username: true } } }
        });
    }

    /**
     * Get system config value with fallback to default
     */
    static async getConfig<T>(key: string, defaultValue: T): Promise<T> {
        try {
            const config = await prisma.systemConfig.findUnique({ where: { key } });
            if (config && config.value) {
                return JSON.parse(config.value) as T;
            }
            return defaultValue;
        } catch (error) {
            console.error(`Failed to load config ${key}`, error);
            return defaultValue;
        }
    }

    /**
     * Check database connectivity and optionally fetch pool metrics
     */
    static async checkDatabaseHealth() {
        // Check DB
        await prisma.$queryRaw`SELECT 1`;

        let poolMetrics = null;
        // Collect Pool Metrics (Prisma Metrics if enabled)
        try {
            if ('$metrics' in prisma) {
                const metrics = await ((prisma as any).$metrics).json();
                const counters = metrics?.counters || [];
                poolMetrics = {
                    active: counters.find((c: Record<string, unknown>) => c.name === 'prisma_client_queries_active')?.value || 0,
                    idle: counters.find((c: Record<string, unknown>) => c.name === 'prisma_client_queries_idle')?.value || 0,
                    wait: counters.find((c: Record<string, unknown>) => c.name === 'prisma_client_queries_wait_count')?.value || 0
                };
            }
        } catch {
            // Metrics feature not enabled in schema or client, skip gracefully
        }

        return poolMetrics;
    }
}
