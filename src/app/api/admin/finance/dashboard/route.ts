import { apiHandler } from '@/lib/api-handler';
import { FinanceDashboardService } from '@/services/finance/dashboard.service';

// GET /api/admin/finance/dashboard - Fetch aggregated metrics and charts data
export const GET = apiHandler(async () => {
    const data = await FinanceDashboardService.getDashboardMetrics();
    return Response.json(data);
}, {
    roles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE']
});
