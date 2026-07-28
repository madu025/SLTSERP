import { apiHandler } from '@/lib/api-handler';
import { GISRouteService } from '@/services/gis/GISRouteService';
import { updateGISRouteSchema, UpdateGISRouteSchema } from '@/lib/validations/gis.schema';
import { GISRoute } from '@prisma/client';

export const dynamic = 'force-dynamic';

/**
 * GET: Retrieve specific GIS route with elements
 */
export const GET = apiHandler<unknown, void>(
    async (_request, params) => {
        const route = await GISRouteService.getRoute(params.routeId);
        if (!route) {
            throw new Error('Route not found');
        }
        return route;
    }
);

/**
 * PATCH: Update specific GIS route
 */
export const PATCH = apiHandler<GISRoute, UpdateGISRouteSchema>(
    async (request, params, body) => {
        const userId = request.headers.get('x-user-id');
        if (!userId) {
            throw new Error('Unauthorized');
        }

        const route = await GISRouteService.updateRoute(params.id, params.routeId, body, userId);
        return route;
    },
    { schema: updateGISRouteSchema }
);

/**
 * DELETE: Delete GIS route and nested child elements transactionally
 */
export const DELETE = apiHandler<unknown, void>(
    async (request, params) => {
        const userId = request.headers.get('x-user-id');
        if (!userId) {
            throw new Error('Unauthorized');
        }

        const result = await GISRouteService.deleteRoute(params.id, params.routeId, userId);
        return result;
    }
);