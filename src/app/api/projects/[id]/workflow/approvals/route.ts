import { requireUuid } from '@/lib/input-guards';
export const dynamic = 'force-dynamic';
import { apiHandler } from '@/lib/api-handler';
import { WorkflowEngine } from '@/services/core/WorkflowEngine';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { assertProjectAccess } from '@/lib/project-access';

export const POST = apiHandler(async (_request, params, body) => {
    const approvalId = body.approvalId ? requireUuid(body.approvalId, 'approvalId') : undefined;
    const status = typeof body.status === 'string' ? body.status : undefined;
    const comments = typeof body.comments === 'string' ? body.comments.slice(0, 2000) : undefined;
    const userId = params._userId;

    if (!approvalId || !status || !userId) {
        throw AppError.badRequest('approvalId, status, and authenticated session are required');
    }

    await assertProjectAccess(params.id, userId);

    try {
        const updated = await WorkflowEngine.submitApproval(approvalId, status, userId, comments, params.id);
        return { success: true, approval: updated };
    } catch (error: unknown) {
        if (error instanceof AppError) throw error;
        throw AppError.internal('Failed to submit approval');
    }
}, {
    permissions: [RBAC_PERMISSIONS.PROJECT_APPROVE],
    audit: { action: 'SUBMIT_APPROVAL', entity: 'WORKFLOW' },
    rawResponse: true
});
