export const dynamic = 'force-dynamic';
import { apiHandler } from '@/lib/api-handler';
import { WorkflowEngine } from '@/services/core/WorkflowEngine';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { assertProjectAccess } from '@/lib/project-access';
import { requireUuid } from '@/lib/input-guards';

export const POST = apiHandler(async (_request, params, body) => {
    const status = typeof body.status === 'string' ? body.status : undefined;
    const stageId = body.stageId ? requireUuid(body.stageId, 'stageId') : undefined;
    const userId = params._userId;

    if (!stageId || !status || !userId) {
        throw AppError.badRequest('stageId, status, and authenticated session are required');
    }

    await assertProjectAccess(params.id, userId);

    try {
        await WorkflowEngine.transitionStage(stageId, status, userId, params.id);
        return { success: true };
    } catch (error: unknown) {
        if (error instanceof AppError) throw error;
        throw AppError.internal('Failed to transition stage');
    }
}, {
    permissions: [RBAC_PERMISSIONS.PROJECT_APPROVE],
    audit: { action: 'TRANSITION_STAGE', entity: 'WORKFLOW' },
    rawResponse: true
});
