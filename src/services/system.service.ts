import { prisma } from '@/lib/prisma';

export interface SystemEvent {
    userId: string;
    action: string;
    entity: string;
    entityId: string;
    oldValue?: any;
    newValue?: any;
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
        try {
            return await prisma.$transaction(async (tx) => {
                // 1. Create Audit Log
                const auditLog = await tx.auditLog.create({
                    data: {
                        userId: event.userId,
                        action: event.action,
                        entity: event.entity,
                        entityId: event.entityId,
                        oldValue: event.oldValue,
                        newValue: event.newValue,
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

                return auditLog;
            });
        } catch (error) {
            console.error('Failed to log system event:', error);
            // We don't want to break the main flow if auditing fails, but we should know about it.
        }
    }

    /**
     * Mark that a user must change their password on next login.
     */
    static async forcePasswordChange(userId: string) {
        return await (prisma.user as any).update({
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
}
