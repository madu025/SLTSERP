import { apiHandler } from '@/lib/api-handler';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { CompanyHealthService } from '@/services/core/company-health.service';
import { resolveOpmcScope } from '@/lib/opmc-scope';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

// GET /api/dashboard/company-health
// Company-wide management view. Requires a management-level capability, and each section is
// additionally limited to the caller's own module capabilities (see CompanyHealthService).
export const GET = apiHandler(async (_request, params) => {
    // The figures are company-wide, so users limited to specific OPMCs must not receive them.
    const scope = await resolveOpmcScope(params._userId);
    if (scope !== undefined) throw AppError.forbidden('Company health is available to users with company-wide access');
    return CompanyHealthService.getCompanyHealth(params._permissions ?? []);
}, {
    permissions: [RBAC_PERMISSIONS.REPORTS_MANAGER_READ, RBAC_PERMISSIONS.ADMIN_RBAC],
    rawResponse: true,
});
