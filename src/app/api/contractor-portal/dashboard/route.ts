import { apiHandler } from '@/lib/api-handler';
import { ContractorDashboardService } from '@/services/contractor-portal/dashboard.service';
import { getRequestAuth } from '@/lib/request-context';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async () => {
    const contractorId = getRequestAuth().contractorId || undefined;

    const dashboardData = await ContractorDashboardService.getDashboardData(contractorId);
    return dashboardData;
}, {
    // Any authenticated user (apiHandler resolves 'ALL' as authenticated-only;
    // anonymous callers are rejected before the handler runs).
});
