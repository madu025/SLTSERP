import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';
import crypto from 'crypto';

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
            const errorLog = await prisma.systemErrorLog.create({
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

            // Trigger automated Webhook alert if critical error
            if (input.statusCode && input.statusCode >= 500) {
                this.triggerCriticalAlert(errorLog).catch(err => {
                    console.error('[ALERT-FAIL] Webhook alert dispatch failed:', err);
                });
            }

            return errorLog;
        } catch (err) {
            // Fail silently to avoid crash loops if DB logging fails
            console.error('[SYSTEM-MONITORING-FAIL] Failed to persist system error log:', err);
            return null;
        }
    }

    /**
     * Automated Webhook Dispatcher for Critical Errors
     */
    private static async triggerCriticalAlert(log: { id: string; statusCode: number; path: string; message: string }) {
        try {
            const webhookSetting = await prisma.systemSetting.findUnique({
                where: { key: 'CRITICAL_ALERT_WEBHOOK' }
            });
            const webhookUrl = (webhookSetting?.value as { url?: string })?.url;
            if (!webhookUrl) return;

            await fetch(webhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: `🚨 *[CRITICAL SLTSERP ALERT]* HTTP ${log.statusCode} on \`${log.path}\`: ${log.message}`,
                    logId: log.id,
                    timestamp: new Date().toISOString()
                })
            });
        } catch (err) {
            console.error('[WEBHOOK-DISPATCH-ERR]', err);
        }
    }

    /**
     * Run SHA-256 Cryptographic Checksum Audit across InventoryLedger & Audit Trails
     */
    static async runLedgerSecurityAudit() {
        const ledgers = await prisma.inventoryLedger.findMany({
            take: 250,
            orderBy: { createdAt: 'desc' }
        });

        let tamperedCount = 0;
        const tamperedEntries: Array<{ id: string; storedChecksum: string; expectedChecksum: string }> = [];

        for (const record of ledgers) {
            if (!record.checksum) continue;

            const payload = `${record.id}:${record.storeId}:${record.itemId}:${record.quantityAfter.toString()}:${record.createdAt.toISOString()}:${record.previousChecksum || ''}`;
            const expectedChecksum = crypto.createHash('sha256').update(payload).digest('hex');

            // Verify hash length AND value match — length-only check would accept any 64-char string
            const isValidHash = record.checksum.length === 64 && record.checksum === expectedChecksum;
            if (!isValidHash) {
                tamperedCount++;
                tamperedEntries.push({
                    id: record.id,
                    storedChecksum: record.checksum,
                    expectedChecksum
                });
            }
        }

        return {
            status: tamperedCount === 0 ? 'SECURE' : 'TAMPERING_DETECTED',
            totalVerified: ledgers.length,
            tamperedCount,
            tamperedEntries,
            auditedAt: new Date().toISOString()
        };
    }

    /**
     * Fetch rate limiting threats & top offending IPs
     */
    static async getSecurityThreats() {
        const past24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const threatLogs = await prisma.systemErrorLog.groupBy({
            by: ['ipAddress'],
            where: {
                createdAt: { gte: past24Hours },
                statusCode: { in: [401, 403, 429] },
                ipAddress: { not: null }
            },
            _count: { _all: true },
            orderBy: { _count: { ipAddress: 'desc' } },
            take: 5
        });

        return threatLogs.map(t => ({
            ipAddress: t.ipAddress || 'UNKNOWN',
            failedAttempts: t._count._all
        }));
    }

    /**
     * Fetch OSP Field Contractor sync & PAT acceptance telemetry
     */
    static async getContractorSyncTelemetry() {
        const [pendingPatCount, inProgressOrders, unreadNotifs] = await Promise.all([
            prisma.serviceOrder.count({ where: { sltsStatus: 'PENDING' } }),
            prisma.serviceOrder.count({ where: { sltsStatus: 'INPROGRESS' } }),
            prisma.qCNotification.count({ where: { isRead: false } })
        ]);

        return {
            pendingPatCount,
            inProgressOrders,
            unreadNotifs,
            syncStatus: pendingPatCount > 20 ? 'HIGH_BACKLOG' : 'NORMAL'
        };
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
            prisma.systemErrorLog.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit
            }),
            prisma.systemErrorLog.count({ where })
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
            return await prisma.systemErrorLog.update({
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
     * Bulk resolve all unresolved error log entries
     */
    static async resolveAllUnresolved(userId: string) {
        const result = await prisma.systemErrorLog.updateMany({
            where: { resolved: false },
            data: {
                resolved: true,
                resolvedAt: new Date(),
                resolvedBy: userId
            }
        });
        return { resolvedCount: result.count };
    }

    /**
     * Clear error logs (all, resolved, or older than X days)
     */
    static async clearLogs(options?: { daysToKeep?: number; clearAll?: boolean } | number) {
        let clearAll = false;
        let daysToKeep = 14;

        if (typeof options === 'number') {
            daysToKeep = options;
        } else if (options) {
            clearAll = !!options.clearAll;
            daysToKeep = options.daysToKeep !== undefined ? options.daysToKeep : 14;
        }

        if (clearAll || daysToKeep === 0) {
            const result = await prisma.systemErrorLog.deleteMany({});
            return { deletedCount: result.count };
        }

        const thresholdDate = new Date();
        thresholdDate.setDate(thresholdDate.getDate() - daysToKeep);

        const result = await prisma.systemErrorLog.deleteMany({
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
     * Fetch real-time system health metrics (RAM, DB Ping, Error Counts, Security Threats, Contractor Telemetry)
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

        const [totalErrors24h, unresolvedCount, topFailingEndpoints, securityThreats, contractorTelemetry] = await Promise.all([
            prisma.systemErrorLog.count({
                where: { createdAt: { gte: past24Hours } }
            }),
            prisma.systemErrorLog.count({
                where: { resolved: false }
            }),
            prisma.systemErrorLog.groupBy({
                by: ['path'],
                where: { createdAt: { gte: past24Hours } },
                _count: { _all: true },
                orderBy: { _count: { path: 'desc' } },
                take: 5
            }),
            this.getSecurityThreats(),
            this.getContractorSyncTelemetry()
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
            securityThreats,
            contractorTelemetry,
            timestamp: new Date().toISOString()
        };
    }
}

