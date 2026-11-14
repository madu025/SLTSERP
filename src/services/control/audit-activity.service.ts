import { prisma } from '@/lib/prisma';
import { DAY_MS, type AuditActivityReport } from '@/lib/control-shared';

/** Actions an auditor wants to see on their own, whatever else is in the log. */
export const SENSITIVE_ACTIONS = ['UPDATE_USER_PERMISSIONS', 'ASSIGN_USER_SECTION', 'REMOVE_USER_SECTION', 'UPDATE_ROLE', 'CREATE_ROLE', 'DELETE_ROLE', 'UPDATE_PASSWORD', 'CLOSE_PERIOD', 'CHANGE_PERIOD_STATUS', 'SF_AUDIT_INVOICE_CLEARANCE'] as const;
const PERMISSION_ACTIONS = ['UPDATE_USER_PERMISSIONS', 'ASSIGN_USER_SECTION', 'REMOVE_USER_SECTION', 'UPDATE_ROLE', 'CREATE_ROLE', 'DELETE_ROLE'];

/** Audit-log analytics: activity per day, repeated access denials, sensitive actions, permission changes, off-hours work (Asia/Colombo). */
export class AuditActivityService {
    static async getReport(days = 30, now = new Date()): Promise<AuditActivityReport> {
        const window = Math.min(180, Math.max(1, days));
        const since = new Date(now.getTime() - window * DAY_MS);

        const [perDay, denied, sensitive] = await Promise.all([
            prisma.$queryRawUnsafe<{ d: Date; n: bigint | number }[]>(
                `SELECT date_trunc('day', "createdAt" AT TIME ZONE 'Asia/Colombo') AS d, count(*) AS n FROM "AuditLog" WHERE "createdAt" >= $1::timestamptz GROUP BY 1 ORDER BY 1`, since),
            prisma.$queryRawUnsafe<{ path: string; username: string | null; n: bigint | number }[]>(
                `SELECT a."entityId" AS path, COALESCE(u."username", 'unknown') AS username, count(*) AS n FROM "AuditLog" a LEFT JOIN "User" u ON u."id" = a."userId"
                 WHERE a."action" = 'ACCESS_DENIED' AND a."createdAt" >= $1::timestamptz GROUP BY 1, 2 ORDER BY 3 DESC LIMIT 10`, since),
            prisma.auditLog.groupBy({ by: ['action'], where: { action: { in: [...SENSITIVE_ACTIONS] }, createdAt: { gte: since } }, _count: { _all: true }, _max: { createdAt: true } }),
        ]);
        const [changes, off, total] = await Promise.all([
            prisma.auditLog.findMany({ where: { action: { in: PERMISSION_ACTIONS }, createdAt: { gte: since } }, orderBy: { createdAt: 'desc' }, take: 15, select: { createdAt: true, action: true, entityId: true, user: { select: { username: true } } } }),
            prisma.$queryRawUnsafe<{ n: bigint | number }[]>(
                `SELECT count(*) AS n FROM "AuditLog" WHERE "createdAt" >= $1::timestamptz AND "userId" IS NOT NULL
                   AND (EXTRACT(HOUR FROM "createdAt" AT TIME ZONE 'Asia/Colombo') < 6 OR EXTRACT(HOUR FROM "createdAt" AT TIME ZONE 'Asia/Colombo') >= 22)`, since),
            prisma.auditLog.count({ where: { createdAt: { gte: since } } }),
        ]);
        return {
            asOf: now.toISOString(),
            days: window,
            perDay: perDay.map((r) => ({ day: new Date(r.d).toISOString().slice(5, 10), count: Number(r.n) })),
            denied: denied.map((r) => ({ path: r.path, user: r.username ?? 'unknown', count: Number(r.n) })),
            sensitive: sensitive.map((r) => ({ action: r.action, count: r._count._all, last: (r._max.createdAt ?? now).toISOString() })).sort((a, b) => b.count - a.count),
            permissionChanges: changes.map((c) => ({ at: c.createdAt.toISOString(), actor: c.user?.username ?? 'system', target: c.entityId, action: c.action })),
            offHours: Number(off[0]?.n ?? 0),
            total,
        };
    }
}
