import { apiHandler } from '@/lib/api-handler';
import { GISRouteService } from '@/services/gis/GISRouteService';
import { saveGISMappingSchema, SaveGISMappingSchema } from '@/lib/validations/gis.schema';

export const dynamic = 'force-dynamic';

/**
 * GET: Fetch the project's GIS material mappings and available inventory items
 */
export const GET = apiHandler<unknown, void>(
    async (_request, params) => {
        const mappings = await GISRouteService.getProjectGISMapping(params.id);
        return mappings;
    }
);

/**
 * POST: Save the project's GIS material mappings
 */
export const POST = apiHandler<unknown, SaveGISMappingSchema>(
    async (_request, params, body) => {
        const enrichedMappings = await GISRouteService.saveProjectGISMapping(params.id, body.mappings);
        return {
            mappings: enrichedMappings,
            message: 'GIS material mappings saved successfully'
        };
    },
    { schema: saveGISMappingSchema }
);