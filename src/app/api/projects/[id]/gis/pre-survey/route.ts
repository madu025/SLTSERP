export const dynamic = 'force-dynamic';
import { apiHandler } from '@/lib/api-handler';
import { GISRouteService } from '@/services/gis/GISRouteService';
import { createPreSurveySchema, CreatePreSurveySchema } from '@/lib/validations/gis.schema';

/**
 * POST: Create AI-generated Pre-Survey Draft
 */
export const POST = apiHandler<unknown, CreatePreSurveySchema>(
    async (request, params, body) => {
        const userId = request.headers.get('x-user-id');
        if (!userId) {
            throw new Error('Unauthorized');
        }

        const result = await GISRouteService.createPreSurveyRoute(params.id, body, userId);
        return result;
    },
    { schema: createPreSurveySchema }
);
