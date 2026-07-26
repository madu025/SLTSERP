import { NextRequest } from 'next/server';
import { apiHandler } from '@/lib/api-handler';
import { FPADashboardService } from '@/services/finance/fpa-dashboard.service';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (req: Request) => {
  const url = new URL(req.url);
  const searchParams = url.searchParams;
  const yearStr = searchParams.get('year') || new Date().getFullYear().toString();
  const quarterStr = searchParams.get('quarter');

  const year = parseInt(yearStr, 10);
  const quarter = quarterStr ? parseInt(quarterStr, 10) : undefined;

  const metrics = await FPADashboardService.getPredictiveProfitability(year, quarter);
  return metrics;
}, {
  roles: ['SUPER_ADMIN', 'FINANCE_MANAGER', 'ADMIN']
});
