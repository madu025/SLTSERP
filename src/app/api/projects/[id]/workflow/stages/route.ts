export const dynamic = 'force-dynamic';
import { apiHandler } from '@/lib/api-handler';
import { WorkflowEngine } from '@/services/core/WorkflowEngine';
import { AppError } from '@/lib/error';
import { ROLE_GROUPS } from '@/config/roles';

export const POST = apiHandler(async (_request, params, body) => {
    const stageId = body.stageId as string | undefined;
    const status = body.status as string | undefined;
    const userId = params._userId;

    if (!stageId || !status || !userId) {
        throw AppError.badRequest('stageId, status, and authenticated session are required');
    }

    try {
        await WorkflowEngine.transitionStage(stageId, status, userId);
        return { success: true };
    } catch (error: unknown) {
        const err = error as { message?: string };
        throw AppError.internal(err?.message || 'Failed to transition stage');
    }
}, {
    roles: ROLE_GROUPS.PROJECT_WORKFLOW_APPROVERS,
    audit: { action: 'TRANSITION_STAGE', entity: 'WORKFLOW' },
    rawResponse: true
});
