import { apiHandler } from '@/lib/api-handler';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { CashForecastService } from '@/services/finance/cash-forecast.service';

export const dynamic = 'force-dynamic';

// GET /api/finance/cash-forecast?weeks=13
// 13-week cash forecast plus receivables risk (DSO, concentration, indicative credit loss).
// OPMC scope is enforced in the service; the company-wide opening cash is withheld from scoped users.
export const GET = apiHandler(async (request, params) => {
    const weeksParam = Number(new URL(request.url).searchParams.get('weeks') ?? 13);
    const weeks = Number.isFinite(weeksParam) ? Math.min(26, Math.max(4, Math.floor(weeksParam))) : 13;
    const [forecast, risk] = await Promise.all([
        CashForecastService.getForecast(params._userId, weeks),
        CashForecastService.getReceivablesRisk(params._userId),
    ]);
    return { forecast, risk };
}, { permissions: [RBAC_PERMISSIONS.FINANCE_READ] });
