import { apiHandler } from '@/lib/api-handler';
import { GISRouteService } from '@/services/gis/GISRouteService';
import { generateBOQSchema, GenerateBOQSchema } from '@/lib/validations/gis.schema';

/**
 * POST: Generate BOQ from GIS route - auto-calculate quantities and create BOTH
 * GISGeneratedBOQ (for GIS tracking) AND ProjectBOQItems (for project BOQ tab / overview)
 */
export const POST = apiHandler<unknown, GenerateBOQSchema>(
    async (request: Request, params: { id: string; routeId: string }, body) => {
        const { id: projectId, routeId } = params;
        const userId = request.headers.get('x-user-id') || 'unknown';

        const result = await GISRouteService.generateBOQFromRoute(projectId, routeId, body, userId);
        return result;
    },
    { schema: generateBOQSchema }
);