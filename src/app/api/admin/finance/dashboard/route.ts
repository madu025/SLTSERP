import { ROLE_GROUPS } from '@/config/roles';
export const dynamic = 'force-dynamic';

import { apiHandler } from '@/lib/api-handler';
import { FinanceDashboardService } from '@/services/finance/dashboard.service';

// GET /api/admin/finance/dashboard - Fetch aggregated metrics and charts data
export const GET = apiHandler(async () => {
    const data = await FinanceDashboardService.getDashboardMetrics();
    return Response.json(data);
}, {
    roles: ROLE_GROUPS.FINANCE_APPROVERS
});
