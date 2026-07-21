import { apiHandler } from '@/lib/api-handler';
import { WorkflowEngine } from '@/services/WorkflowEngine';
import { AppError } from '@/lib/error';

export const POST = apiHandler(async (_request, _params, body) => {
    const { stageId, status, userId } = body || {};

    if (!stageId || !status || !userId) {
        throw AppError.badRequest('stageId, status, and userId are required');
    }

    try {
        await WorkflowEngine.transitionStage(stageId, status, userId);
        return { success: true };
    } catch (error: unknown) {
        const err = error as { message?: string };
        throw AppError.internal(err?.message || 'Failed to transition stage');
    }
}, {
    audit: { action: 'TRANSITION_STAGE', entity: 'WORKFLOW' },
    rawResponse: true
});
