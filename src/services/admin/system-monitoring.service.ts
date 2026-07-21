import { prisma, primaryClient } from '@/lib/prisma';
import { AppError } from '@/lib/error';

export interface LogErrorInput {
    statusCode?: number;
    errorCode?: string;
    message: string;
    stackTrace?: string;
    path: string;
    method?: string;
    userId?: string;
    userRole?: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, unknown>;
}

export interface ErrorLogsFilter {
    page?: number;
    limit?: number;
    statusCode?: number;
    path?: string;
    resolved?: boolean;
    search?: string;
}

export class SystemMonitoringService {
    /**
     * Log a server error or exception to database asynchronously
     */
    static async logError(input: LogErrorInput) {
        try {
            return await (primaryClient as any).systemErrorLog.create({
                data: {
                    statusCode: input.statusCode || 500,
                    errorCode: input.errorCode || 'INTERNAL_ERROR',
                    message: input.message || 'An unknown error occurred',
                    stackTrace: input.stackTrace,
                    path: input.path,
                    method: input.method || 'GET',
                    userId: input.userId,
                    userRole: input.userRole,
                    ipAddress: input.ipAddress,
                    userAgent: input.userAgent,
                    metadata: input.metadata ? JSON.parse(JSON.stringify(input.metadata)) : undefined
                }
            });
        } catch (err) {
            // Fail silently to avoid crash loops if DB logging fails
            console.error('[SYSTEM-MONITORING-FAIL] Failed to persist system error log:', err);
            return null;
        }
    }

    /**
     * Fetch paginated error logs for Super Admin inspection
     */
    static async getErrorLogs(filter: ErrorLogsFilter) {
        const page = Math.max(1, filter.page || 1);
        const limit = Math.min(100, Math.max(10, filter.limit || 25));
        const skip = (page - 1) * limit;

        const where: Record<string, unknown> = {};

        if (filter.statusCode) {
            where.statusCode = filter.statusCode;
        }

        if (filter.resolved !== undefined) {
            where.resolved = filter.resolved;
        }

        if (filter.path) {
            where.path = { contains: filter.path, mode: 'insensitive' };
        }

        if (filter.search) {
            where.OR = [
                { message: { contains: filter.search, mode: 'insensitive' } },
                { path: { contains: filter.search, mode: 'insensitive' } },
                { errorCode: { contains: filter.search, mode: 'insensitive' } }
            ];
        }

        const [logs, total] = await prisma.$transaction([
            (primaryClient as any).systemErrorLog.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit
            }),
            (primaryClient as any).systemErrorLog.count({ where })
        ]);

        return {
            logs,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            }
        };
    }

    /**
     * Mark an error log entry as resolved
     */
    static async markResolved(errorId: string, userId: string) {
        try {
            return await (primaryClient as any).systemErrorLog.update({
                where: { id: errorId },
                data: {
                    resolved: true,
                    resolvedAt: new Date(),
                    resolvedBy: userId
                }
            });
        } catch (error: unknown) {
            if ((error as { code?: string })?.code === 'P2025') {
                throw AppError.notFound('Error log entry not found');
            }
            throw error;
        }
    }

    /**
     * Clear resolved error logs or logs older than X days
     */
    static async clearLogs(daysToKeep = 14) {
        const thresholdDate = new Date();
        thresholdDate.setDate(thresholdDate.getDate() - daysToKeep);

        const result = await (primaryClient as any).systemErrorLog.deleteMany({
            where: {
                OR: [
                    { resolved: true },
                    { createdAt: { lt: thresholdDate } }
                ]
            }
        });

        return { deletedCount: result.count };
    }

    /**
     * Fetch real-time system health metrics (RAM, DB Ping, Error Counts)
     */
    static async getHealthStats() {
        const memory = process.memoryUsage();
        const memoryStats = {
            heapUsedMB: Math.round(memory.heapUsed / 1024 / 1024),
            heapTotalMB: Math.round(memory.heapTotal / 1024 / 1024),
            rssMB: Math.round(memory.rss / 1024 / 1024)
        };

        const uptimeSeconds = Math.floor(process.uptime());

        // Measure DB Latency
        const dbStart = Date.now();
        let dbStatus = 'ONLINE';
        let dbLatencyMs = 0;
        try {
            await prisma.$queryRaw`SELECT 1`;
            dbLatencyMs = Date.now() - dbStart;
        } catch (e) {
            console.error('[HEALTH-CHECK] Database ping failed:', e);
            dbStatus = 'OFFLINE';
        }

        const past24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);

        const [totalErrors24h, unresolvedCount, topFailingEndpoints] = await Promise.all([
            (primaryClient as any).systemErrorLog.count({
                where: { createdAt: { gte: past24Hours } }
            }),
            (primaryClient as any).systemErrorLog.count({
                where: { resolved: false }
            }),
            (primaryClient as any).systemErrorLog.groupBy({
                by: ['path'],
                where: { createdAt: { gte: past24Hours } },
                _count: { _all: true },
                orderBy: { _count: { path: 'desc' } },
                take: 5
            })
        ]);

        return {
            status: dbStatus === 'ONLINE' ? 'HEALTHY' : 'DEGRADED',
            memory: memoryStats,
            uptimeSeconds,
            database: {
                status: dbStatus,
                latencyMs: dbLatencyMs
            },
            errors: {
                total24h: totalErrors24h,
                unresolved: unresolvedCount,
                topFailing: topFailingEndpoints.map((item: { path: string; _count: { _all: number } }) => ({
                    path: item.path,
                    count: item._count._all
                }))
            },
            timestamp: new Date().toISOString()
        };
    }
}
