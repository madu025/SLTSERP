export const dynamic = 'force-dynamic';

import { apiHandler } from '@/lib/api-handler';
import { GISRouteService } from '@/services/gis/GISRouteService';
import { updateGISRouteElementsSchema, UpdateGISRouteElementsSchema } from '@/lib/validations/gis.schema';

/**
 * GET: Fetch As-Planned vs As-Built progress for a GIS route
 */
export const GET = apiHandler<unknown, void>(
    async (_request, params) => {
        const progress = await GISRouteService.getRouteProgress(params.id, params.routeId);
        return progress;
    }
);

/**
 * PATCH: Update status of individual GIS elements (bulk update)
 */
export const PATCH = apiHandler<unknown, UpdateGISRouteElementsSchema>(
    async (_request, params, body) => {
        const result = await GISRouteService.updateGISRouteElements(params.id, params.routeId, body);
        return result;
    },
    { schema: updateGISRouteElementsSchema }
);