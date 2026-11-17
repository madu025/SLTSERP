export const dynamic = 'force-dynamic';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { getUserEffectivePermissions } from '@/lib/user-permissions';
import { resolveOpmcScope } from '@/lib/opmc-scope';
import { reportMeta, runUserReport } from '@/services/reports/report-center.service';
import { z } from 'zod';

const runSchema = z.object({
    entity: z.enum(['serviceOrder', 'materialUsage', 'contractorStock', 'journalEntry', 'wastage']),
    columns: z.array(z.string()).default([]),
    filters: z.array(z.object({
        field: z.string(),
        operator: z.enum(['equals', 'contains', 'gt', 'lt', 'gte', 'lte', 'startsWith']),
        value: z.string(),
    })).default([]),
    aggregation: z.object({ groupBy: z.string(), targetField: z.string(), type: z.enum(['SUM', 'AVG', 'COUNT']) }).optional(),
});

async function caller(userId: string | undefined) {
    if (!userId) throw AppError.unauthorized('Authentication required');
    const [permissions, scope] = await Promise.all([getUserEffectivePermissions(userId), resolveOpmcScope(userId)]);
    return { permissions: new Set(permissions), scope };
}

// GET /api/reports/custom: the entities and fields this user may report on
export const GET = apiHandler(async (_req, params) => {
    const { permissions, scope } = await caller(params._userId ?? undefined);
    return { entities: reportMeta(permissions, scope) };
}, { permissions: [RBAC_PERMISSIONS.REPORTS_READ] });

// POST /api/reports/custom: run a report (capability, finance/cost fields and OPMC scope enforced in the service)
export const POST = apiHandler(async (_req, params, body) => {
    const payload = runSchema.parse(body);
    if (!payload.aggregation && payload.columns.length === 0) throw AppError.badRequest('Choose at least one column or a grouping.');
    const { permissions, scope } = await caller(params._userId ?? undefined);
    const result = await runUserReport(payload, permissions, scope, { rowLimit: 500 });
    if ('error' in result) throw AppError.badRequest(result.error);
    return result;
}, {
    permissions: [RBAC_PERMISSIONS.REPORTS_READ],
    audit: { action: 'GENERATE_CUSTOM_REPORT', entity: 'Reports' },
});
