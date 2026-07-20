import { ServiceOrderDashboardService } from '@/services/sod-dashboard.service';
import { apiHandler } from '@/lib/api-handler';
import { withTracing } from '@/lib/tracing-utils';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(withTracing(async (request) => {
    const { searchParams } = new URL(request.url);
    const queryUserId = searchParams.get('userId');
    const headerUserId = request.headers.get('x-user-id');
    const userId = queryUserId || headerUserId;

    if (!userId) {
        throw AppError.badRequest('User ID required');
    }

    const filterRegion = searchParams.get('region') || 'ALL';
    const filterRtom = searchParams.get('rtom') || 'ALL';

    const data = await ServiceOrderDashboardService.getServiceOrderStats({
        userId,
        filterRegion,
        filterRtom
    });

    return data;
}), { rawResponse: true });
