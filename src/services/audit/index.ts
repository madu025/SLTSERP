import { AuditRepository } from '@/repositories/audit.repository';
import { toUuidOrNull } from '@/lib/uuid';

export interface AuditLogParams {
    userId: string;
    action: string;
    entity: string;
    entityId: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    oldValue?: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
            return await AuditRepository.create({
                // AuditLog.userId is a uuid column, but sync and automation callers pass labels
                // ('SYNC_SERVICE', 'SYSTEM_AUTO_COMPLETE'). Prisma rejects those with P2023 and,
                // because log() swallows the error, the whole audit trail of that change silently
                // disappears. Non-user actors are stored as null, exactly as the schema documents.
                userId: toUuidOrNull(params.userId),
                action: params.action,
                entity: params.entity,
                entityId: params.entityId,
                oldValue: params.oldValue,
                newValue: params.newValue,
                ipAddress: params.ipAddress,
                userAgent: params.userAgent,
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
        return await AuditRepository.findMany({
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
        return await AuditRepository.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 100
        });
    }

    /**
     * Get recent global audit logs
     */
    static async getRecentLogs(take: number = 200) {
        return await AuditRepository.findMany({
            take,
            orderBy: { createdAt: 'desc' },
            include: {
                user: {
                    select: {
                        name: true,
                        username: true
                    }
                }
            }
        });
    }
}
