import { apiHandler } from '@/lib/api-handler';
import { GISRouteService } from '@/services/gis/GISRouteService';
import { updateGISRouteElementsSchema, UpdateGISRouteElementsSchema } from '@/lib/validations/gis.schema';

/**
 * GET: Fetch As-Planned vs As-Built progress for a GIS route
 */
export const GET = apiHandler<unknown, void>(
    async (request: Request, params: { id: string; routeId: string }) => {
        const { id: projectId, routeId } = params;
        const progress = await GISRouteService.getRouteProgress(projectId, routeId);
        return progress;
    }
);

/**
 * PATCH: Update status of individual GIS elements (bulk update)
 */
export const PATCH = apiHandler<unknown, UpdateGISRouteElementsSchema>(
    async (request: Request, params: { id: string; routeId: string }, body) => {
        const { id: projectId, routeId } = params;
        const result = await GISRouteService.updateGISRouteElements(projectId, routeId, body);
        return result;
    },
    { schema: updateGISRouteElementsSchema }
);