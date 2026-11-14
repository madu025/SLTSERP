import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { resolveOpmcScope } from '@/lib/opmc-scope';
import { LiabilitiesScheduleService } from '@/services/finance/liabilities-schedule.service';

export const dynamic = 'force-dynamic';

// GET /api/finance/liabilities?asOf=
// Company-wide liabilities schedule. The general ledger has no complete per-OPMC split of liabilities,
// so users limited to specific OPMCs are refused rather than shown a partial or global figure.
export const GET = apiHandler(async (req, params) => {
    const scope = await resolveOpmcScope(params._userId);
    if (scope !== undefined) throw AppError.forbidden('The liabilities schedule is available to users with company-wide access');
    const asOfStr = new URL(req.url).searchParams.get('asOf');
    const asOf = asOfStr ? new Date(asOfStr) : new Date();
    if (Number.isNaN(asOf.getTime())) throw AppError.badRequest('asOf must be a valid date');
    return LiabilitiesScheduleService.getSchedule(asOf);
}, { permissions: [RBAC_PERMISSIONS.FINANCE_READ] });
