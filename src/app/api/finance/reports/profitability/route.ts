import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { ProfitabilityService, type ProfitabilityDimension } from '@/services/finance/profitability.service';

export const dynamic = 'force-dynamic';

// GET /api/finance/reports/profitability?by=opmc|project&from=&to=
// Profit by OPMC or project. OPMC scope is enforced in the service.
export const GET = apiHandler(async (req, params) => {
    const { searchParams } = new URL(req.url);
    const by = (searchParams.get('by') ?? 'opmc') as ProfitabilityDimension;
    if (by !== 'opmc' && by !== 'project') throw AppError.badRequest('by must be opmc or project');
    const from = searchParams.get('from') ? new Date(searchParams.get('from')!) : undefined;
    const to = searchParams.get('to') ? new Date(searchParams.get('to')!) : undefined;
    if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime()))) throw AppError.badRequest('from/to must be valid dates');
    return ProfitabilityService.getReport(params._userId, by, from, to);
}, { permissions: [RBAC_PERMISSIONS.FINANCE_READ] });
