import { apiHandler } from '@/lib/api-handler';
import { WorkflowEngine } from '@/services/core/WorkflowEngine';
import { AppError } from '@/lib/error';

export const POST = apiHandler(async (_request, _params, body) => {
    const stageId = body.stageId as string | undefined;
    const status = body.status as string | undefined;
    const userId = body.userId as string | undefined;

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
