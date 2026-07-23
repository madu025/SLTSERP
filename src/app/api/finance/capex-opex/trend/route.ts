import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { CapexOpexDashboardService } from '@/services/finance/capex-opex-dashboard.service';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (request) => {
  const { searchParams } = new URL(request.url);

  const opmcId = searchParams.get('opmcId');
  const fiscalYearStr = searchParams.get('fiscalYear');

  if (!opmcId) throw AppError.badRequest('opmcId is required');
  if (!fiscalYearStr) throw AppError.badRequest('fiscalYear is required');

  const fiscalYear = Number(fiscalYearStr);
  if (isNaN(fiscalYear)) throw AppError.badRequest('Invalid fiscalYear');

  const trend = await CapexOpexDashboardService.getMonthlyTrend(opmcId, fiscalYear);

  return { fiscalYear, opmcId, trend };
}, {
  roles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'FINANCE_ASSISTANT', 'OSP_MANAGER', 'AREA_MANAGER'],
  rawResponse: true,
});
