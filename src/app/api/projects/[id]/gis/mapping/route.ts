import { apiHandler } from '@/lib/api-handler';
import { GISRouteService } from '@/services/gis/GISRouteService';
import { saveGISMappingSchema, SaveGISMappingSchema } from '@/lib/validations/gis.schema';

export const dynamic = 'force-dynamic';

/**
 * GET: Fetch the project's GIS material mappings and available inventory items
 */
export const GET = apiHandler<unknown, void>(
    async (request: Request, params: { id: string }) => {
        const { id: projectId } = params;
        const mappings = await GISRouteService.getProjectGISMapping(projectId);
        return mappings;
    }
);

/**
 * POST: Save the project's GIS material mappings
 */
export const POST = apiHandler<unknown, SaveGISMappingSchema>(
    async (request: Request, params: { id: string }, body) => {
        const { id: projectId } = params;
        
        const enrichedMappings = await GISRouteService.saveProjectGISMapping(projectId, body.mappings);
        return {
            mappings: enrichedMappings,
            message: 'GIS material mappings saved successfully'
        };
    },
    { schema: saveGISMappingSchema }
);