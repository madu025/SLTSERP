import { apiHandler } from '@/lib/api-handler';
import { GISRouteOptimizerService } from '@/services/gis/gis-optimizer.service';
import { GISRouteService } from '@/services/gis/GISRouteService';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (request, params) => {
    const { id: projectId, routeId } = await params;
    const { searchParams } = new URL(request.url);
    const parsedTolerance = parseInt(searchParams.get('tolerance') || '10', 10);
    const tolerance = Number.isFinite(parsedTolerance) ? Math.min(Math.max(parsedTolerance, 1), 1000) : 10;
    await GISRouteService.assertRouteInProject(projectId, routeId);

    try {
        return await GISRouteOptimizerService.optimizeRoute(projectId, routeId, tolerance);
    } catch (error: unknown) {
        // Typed errors (e.g. route not found) keep their status; anything else is logged by apiHandler, not echoed
        if (error instanceof AppError) throw error;
        throw AppError.internal('Failed to optimize GIS route');
    }
}, { rawResponse: true });
