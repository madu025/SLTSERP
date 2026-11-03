import { getAuthenticatedUserId } from '@/lib/request-context';
export const dynamic = 'force-dynamic';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { GISRouteService } from '@/services/gis/GISRouteService';
import { generateBOQSchema, GenerateBOQSchema } from '@/lib/validations/gis.schema';

/**
 * POST: Generate BOQ from GIS route - auto-calculate quantities and create BOTH
 * GISGeneratedBOQ (for GIS tracking) AND ProjectBOQItems (for project BOQ tab / overview)
 */
export const POST = apiHandler<unknown, GenerateBOQSchema>(
    async (request, params, body) => {
        const userId = getAuthenticatedUserId();
        if (!userId) throw AppError.unauthorized('Authentication required');

        const result = await GISRouteService.generateBOQFromRoute(params.id, params.routeId, body, userId);
        return result;
    },
    { schema: generateBOQSchema }
);
