export const dynamic = 'force-dynamic';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { getUserEffectivePermissions } from '@/lib/user-permissions';
import { resolveOpmcScope } from '@/lib/opmc-scope';
import { runUserReport } from '@/services/reports/report-center.service';
import { z } from 'zod';

const dynamicReportSchema = z.object({
    entity: z.enum(['serviceOrder', 'materialUsage', 'contractorStock', 'journalEntry', 'wastage']),
    columns: z.array(z.string()).min(1, 'At least one column is required'),
    filters: z.array(z.object({
        field: z.string(),
        operator: z.enum(['equals', 'contains', 'gt', 'lt', 'gte', 'lte', 'startsWith']),
        value: z.string()
    })),
    aggregation: z.object({
        groupBy: z.string(),
        targetField: z.string(),
        type: z.enum(['SUM', 'AVG', 'COUNT'])
    }).optional()
});

// Same secure runner as the Report Center: entity capability, finance/cost field capability and OPMC scope are enforced.
export const POST = apiHandler(async (_req, params, body) => {
    const payload = dynamicReportSchema.parse(body);
    const userId = params._userId;
    if (!userId) throw AppError.unauthorized('Authentication required');
    const [permissions, scope] = await Promise.all([getUserEffectivePermissions(userId), resolveOpmcScope(userId)]);
    const result = await runUserReport(payload, new Set(permissions), scope, { rowLimit: 500 });
    if ('error' in result) throw AppError.badRequest(result.error);
    return result;
}, {
    permissions: [RBAC_PERMISSIONS.REPORTS_READ],
    audit: { action: 'GENERATE_DYNAMIC_REPORT', entity: 'Reports' }
});
