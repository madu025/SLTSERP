import { prisma } from '@/lib/prisma';

export interface AuditLogParams {
    userId: string;
    action: string;
    entity: string;
    entityId: string;
    oldValue?: any;
    newValue?: any;
    ipAddress?: string;
    userAgent?: string;
}

export class AuditService {
    /**
     * Create a new audit log entry
     */
    static async log(params: AuditLogParams) {
        try {
            return await (prisma as any).auditLog.create({
                data: {
                    userId: params.userId,
                    action: params.action,
                    entity: params.entity,
                    entityId: params.entityId,
                    oldValue: params.oldValue,
                    newValue: params.newValue,
                    ipAddress: params.ipAddress,
                    userAgent: params.userAgent,
                }
            });
        } catch (error) {
            console.error('Audit Log Error:', error);
            // We don't want to throw error if logging fails, to avoid breaking the main operation
            return null;
        }
    }

    /**
     * Get audit logs for a specific entity
     */
    static async getEntityLogs(entity: string, entityId: string) {
        return await (prisma as any).auditLog.findMany({
            where: { entity, entityId },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        username: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
    }

    /**
     * Get audit logs by a specific user
     */
    static async getUserLogs(userId: string) {
        return await (prisma as any).auditLog.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 100
        });
    }
}
