import { apiHandler } from '@/lib/api-handler';
import { GISRouteService } from '@/services/gis/GISRouteService';
import { createGISRouteSchema, CreateGISRouteSchema } from '@/lib/validations/gis.schema';
import { GISRoute } from '@prisma/client';

export const dynamic = 'force-dynamic';

/**
 * GET: List GIS routes for project with poles count
 */
export const GET = apiHandler<unknown[], void>(
    async (_request, params) => {
        const gisRoutes = await GISRouteService.listProjectRoutes(params.id);
        return gisRoutes;
    }
);

/**
 * POST: Create a GIS route
 */
export const POST = apiHandler<GISRoute, CreateGISRouteSchema>(
    async (request, params, body) => {
        const userId = request.headers.get('x-user-id') || 'unknown';
        const gisRoute = await GISRouteService.createGISRoute(params.id, body, userId);
        return gisRoute;
    },
    { schema: createGISRouteSchema }
);
