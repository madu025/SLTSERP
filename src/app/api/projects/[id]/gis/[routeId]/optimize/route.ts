import { apiHandler } from '@/lib/api-handler';
import { GISRouteOptimizerService } from '@/services/gis-optimizer.service';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (request, params) => {
    const { id: projectId, routeId } = await params;
    const { searchParams } = new URL(request.url);
    const tolerance = parseInt(searchParams.get('tolerance') || '10', 10);

    try {
        return await GISRouteOptimizerService.optimizeRoute(projectId, routeId, tolerance);
    } catch (error: unknown) {
        const err = error as { message?: string };
        throw AppError.internal(err?.message || 'Failed to optimize GIS route');
    }
}, { rawResponse: true });
