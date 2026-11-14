export const dynamic = 'force-dynamic';

import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

const MAX_LIMIT = 500;

// GET /api/admin/audit-logs?limit=&before=&user=&entity=&action=&from=&to=&q=
// Newest first. Without parameters it returns the latest 200 rows, exactly as before. `before` (ISO time of the last row
// received) pages further back; the filters run in the database, so they cover the whole log and not only the latest rows.
export const GET = apiHandler(async (req) => {
    const sp = new URL(req.url).searchParams;
    const limit = Math.min(MAX_LIMIT, Math.max(1, Number(sp.get('limit') ?? 200) || 200));
    const date = (k: string) => {
        const v = sp.get(k);
        if (!v) return undefined;
        const d = new Date(v);
        if (Number.isNaN(d.getTime())) throw AppError.badRequest(`${k} must be a valid date`);
        return d;
    };
    const before = date('before');
    const from = date('from');
    const to = date('to');

    const where: Prisma.AuditLogWhereInput = {
        ...(sp.get('entity') ? { entity: sp.get('entity')! } : {}),
        ...(sp.get('action') ? { action: sp.get('action')! } : {}),
        ...(sp.get('user') ? { user: { username: { equals: sp.get('user')!, mode: 'insensitive' } } } : {}),
        ...(sp.get('q') ? { OR: [{ entityId: { contains: sp.get('q')!, mode: 'insensitive' } }, { action: { contains: sp.get('q')!, mode: 'insensitive' } }] } : {}),
        ...((from || to || before) ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}), ...(before ? { lt: before } : {}) } } : {}),
    };
    return prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: { user: { select: { name: true, username: true } } },
    });
}, {});
