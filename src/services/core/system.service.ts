import { prisma } from '@/lib/prisma';
import { safe } from '@/utils/safe-await.util';
import { NotificationRepository } from '@/repositories/notification.repository';

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
    /** Override notification recipient (defaults to userId). Use when the actor and recipient differ. */
    notifyUserId?: string;
}

export class SystemService {
    /** UUID v4/v7 matcher - audit userId column only accepts real user UUIDs. */
    private static readonly UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    /**
     * Unified method to log an audit event and optionally send a notification.
     * Use this to avoid duplicating logic across different API routes.
     */
    static async logEvent(event: SystemEvent) {
        // Non-user actors ('system', cron, missing header) cannot satisfy the
        // User FK - store null instead of corrupting the audit write.
        const auditUserId = this.UUID_RE.test(event.userId) ? event.userId : null;

        // 1. Audit log -- MUST succeed, isolated transaction.
        //    Notification failures must NEVER roll back audit writes.
        const [auditError, auditLog] = await safe(prisma.$transaction(async (tx) => {
            return tx.auditLog.create({
                data: {
                    userId: auditUserId,
                    action: event.action,
                    entity: event.entity,
                    entityId: event.entityId,
                    oldValue: event.oldValue ? JSON.parse(JSON.stringify(event.oldValue)) : undefined,
                    newValue: event.newValue ? JSON.parse(JSON.stringify(event.newValue)) : undefined,
                    ipAddress: event.ipAddress,
                    userAgent: event.userAgent,
                }
            });
        }));

        if (auditError) {
            console.error('[AUDIT-WRITE-FAILED]', auditError);
            return null;
        }

        // 2. Notification -- best-effort, outside the audit transaction.
        //    Failures are logged but never block the audit write above.
        //    Uses category-based upsert: replaces any existing unread notification
        //    with the same userId + type + link instead of accumulating rows.
        if (event.notify && event.notifyTitle && event.notifyMessage) {
            const notificationUserId = event.notifyUserId && this.UUID_RE.test(event.notifyUserId)
                ? event.notifyUserId
                : auditUserId;
            if (notificationUserId) {
                try {
                    await NotificationRepository.replaceUnreadByCategory(
                        notificationUserId,
                        event.notifyType || 'SYSTEM',
                        event.notifyLink,
                        {
                            title: event.notifyTitle,
                            message: event.notifyMessage,
                            priority: event.notifyPriority || 'MEDIUM',
                        }
                    );
                } catch (notifError) {
                    console.error('[NOTIFICATION-WRITE-FAILED]', {
                        auditId: auditLog?.id,
                        error: notifError,
                    });
                }
            }
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
