import { apiHandler } from '@/lib/api-handler';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { CompanyHealthService } from '@/services/core/company-health.service';
import { resolveOpmcScope } from '@/lib/opmc-scope';
import { AppError } from '@/lib/error';
import { swrMemo } from '@/lib/swr-memo';

export const dynamic = 'force-dynamic';

// GET /api/dashboard/company-health
// Company-wide management view. Requires a management-level capability, and each section is
// additionally limited to the caller's own module capabilities (see CompanyHealthService).
export const GET = apiHandler(async (_request, params) => {
    // The figures are company-wide, so users limited to specific OPMCs must not receive them.
    const scope = await resolveOpmcScope(params._userId, 'company');
    if (scope !== undefined) throw AppError.forbidden('Company health is available to users with company-wide access');
    const permissions = params._permissions ?? [];
    const userId = params._userId ?? undefined;
    // The result depends only on the caller's capability set and id, so that is the whole cache key.
    // Fresh for 2 minutes, then served stale for up to 15 while one background refresh runs.
    const key = `company-health:${userId ?? 'anon'}:${[...permissions].sort().join(',')}`;
    return swrMemo(key, 2 * 60_000, 15 * 60_000, () => CompanyHealthService.getCompanyHealth(permissions, new Date(), userId));
}, {
    permissions: [RBAC_PERMISSIONS.REPORTS_MANAGER_READ, RBAC_PERMISSIONS.ADMIN_RBAC],
    rawResponse: true,
});
