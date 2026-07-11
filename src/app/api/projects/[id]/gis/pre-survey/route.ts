import { apiHandler } from '@/lib/api-handler';
import { GISRouteService } from '@/services/gis/GISRouteService';
import { createPreSurveySchema, CreatePreSurveySchema } from '@/lib/validations/gis.schema';

/**
 * POST: Create AI-generated Pre-Survey Draft
 */
export const POST = apiHandler<unknown, CreatePreSurveySchema>(
    async (request: Request, params: { id: string }, body) => {
        const { id: projectId } = params;
        const userId = request.headers.get('x-user-id');
        if (!userId) {
            throw new Error('Unauthorized');
        }

        const result = await GISRouteService.createPreSurveyRoute(projectId, body, userId);
        return result;
    },
    { schema: createPreSurveySchema }
);
