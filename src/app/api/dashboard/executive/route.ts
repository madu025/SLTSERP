import { ExecutiveDashboardService } from '@/services/executive-dashboard.service';
import { apiHandler } from '@/lib/api-handler';

export const dynamic = 'force-dynamic';

// GET /api/dashboard/executive
export const GET = apiHandler(async (request) => {
    const { searchParams } = new URL(request.url);
    const opmcIdsParam = searchParams.get('opmcIds');
    const opmcIds = opmcIdsParam ? opmcIdsParam.split(',') : undefined;

    const data = await ExecutiveDashboardService.getDashboardData(opmcIds);
    return data;
}, { rawResponse: true });
