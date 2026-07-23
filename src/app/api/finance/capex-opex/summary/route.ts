import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { CapexOpexDashboardService } from '@/services/finance/capex-opex-dashboard.service';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (request) => {
  const { searchParams } = new URL(request.url);

  const opmcId = searchParams.get('opmcId');
  const fiscalYearStr = searchParams.get('fiscalYear');
  const quarterStr = searchParams.get('quarter');

  if (!opmcId) throw AppError.badRequest('opmcId is required');
  if (!fiscalYearStr) throw AppError.badRequest('fiscalYear is required');

  const fiscalYear = Number(fiscalYearStr);
  if (isNaN(fiscalYear) || fiscalYear < 2020 || fiscalYear > 2100) {
    throw AppError.badRequest('Invalid fiscalYear');
  }

  const quarter = quarterStr ? Number(quarterStr) : undefined;
  if (quarter !== undefined && (isNaN(quarter) || quarter < 1 || quarter > 4)) {
    throw AppError.badRequest('quarter must be 1-4');
  }

  const [summary, kpi, topExpenses] = await Promise.all([
    CapexOpexDashboardService.getExecutiveSummary(opmcId, fiscalYear, quarter),
    CapexOpexDashboardService.getKpiPanel(opmcId, fiscalYear),
    CapexOpexDashboardService.getTopExpenses(opmcId, fiscalYear, 5),
  ]);

  return { ...summary, kpi, topExpenses };
}, {
  roles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'FINANCE_ASSISTANT', 'OSP_MANAGER', 'AREA_MANAGER'],
  rawResponse: true,
});
