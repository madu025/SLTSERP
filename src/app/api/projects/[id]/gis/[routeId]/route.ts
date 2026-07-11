import { apiHandler } from '@/lib/api-handler';
import { GISRouteService } from '@/services/gis/GISRouteService';
import { updateGISRouteSchema, UpdateGISRouteSchema } from '@/lib/validations/gis.schema';
import { GISRoute } from '@prisma/client';

export const dynamic = 'force-dynamic';

/**
 * GET: Retrieve specific GIS route with elements
 */
export const GET = apiHandler<unknown, void>(
    async (request: Request, params: { id: string; routeId: string }) => {
        const { routeId } = params;
        const route = await GISRouteService.getRoute(routeId);
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
    async (request: Request, params: { id: string; routeId: string }, body) => {
        const { id: projectId, routeId } = params;
        const userId = request.headers.get('x-user-id');
        if (!userId) {
            throw new Error('Unauthorized');
        }

        const route = await GISRouteService.updateRoute(projectId, routeId, body, userId);
        return route;
    },
    { schema: updateGISRouteSchema }
);

/**
 * DELETE: Delete GIS route and nested child elements transactionally
 */
export const DELETE = apiHandler<unknown, void>(
    async (request: Request, params: { id: string; routeId: string }) => {
        const { id: projectId, routeId } = params;
        const userId = request.headers.get('x-user-id');
        if (!userId) {
            throw new Error('Unauthorized');
        }

        const result = await GISRouteService.deleteRoute(projectId, routeId, userId);
        return result;
    }
);