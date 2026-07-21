import { apiHandler } from '@/lib/api-handler';
import { AiPredictionService } from '@/services/ai-prediction.service';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (_request, params) => {
    const { id: projectId } = params;
    return await AiPredictionService.getSavedPredictions(projectId);
}, { rawResponse: true });

export const POST = apiHandler(async (_request, params) => {
    const { id: projectId } = params;
    return await AiPredictionService.getAllPredictions(projectId);
}, {
    audit: { action: 'GENERATE_AI_PREDICTION', entity: 'PROJECT' },
    rawResponse: true
});
