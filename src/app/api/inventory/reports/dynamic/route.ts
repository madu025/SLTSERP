export const dynamic = 'force-dynamic';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { getUserEffectivePermissions } from '@/lib/user-permissions';
import { resolveOpmcScope } from '@/lib/opmc-scope';
import { runUserReport } from '@/services/reports/report-center.service';

// Kept for existing callers; runs through the same secure runner as the Report Center (capability + OPMC scope).
export const POST = apiHandler(async (_request, params, body) => {
    const userId = params._userId;
    if (!userId) throw AppError.unauthorized('Authentication required');
    const [permissions, scope] = await Promise.all([getUserEffectivePermissions(userId), resolveOpmcScope(userId, 'inventory')]);
    const result = await runUserReport(body as Record<string, unknown>, new Set(permissions), scope, { rowLimit: 500 });
    if ('error' in result) throw AppError.badRequest(result.error);
    return { success: true, data: result };
}, { rawResponse: true, permissions: [RBAC_PERMISSIONS.REPORTS_READ] });
