import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { ContractorScorecardService } from '@/services/contractor/contractor-scorecard.service';

export const dynamic = 'force-dynamic';

// GET /api/contractors/scorecard?month=YYYY-MM&months=6
// Contractor league table from service-order outcomes. OPMC scope is enforced in the service.
export const GET = apiHandler(async (req, params) => {
    const { searchParams } = new URL(req.url);
    const month = searchParams.get('month') ?? undefined;
    if (month && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw AppError.badRequest('month must be YYYY-MM');
    const months = Number(searchParams.get('months') ?? 6);
    if (!Number.isInteger(months) || months < 1 || months > 12) throw AppError.badRequest('months must be between 1 and 12');
    return ContractorScorecardService.getScorecard(params._userId, month, months);
}, { permissions: [RBAC_PERMISSIONS.CONTRACTOR_READ] });
