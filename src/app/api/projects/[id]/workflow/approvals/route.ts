export const dynamic = 'force-dynamic';
import { apiHandler } from '@/lib/api-handler';
import { WorkflowEngine } from '@/services/core/WorkflowEngine';
import { AppError } from '@/lib/error';
import { ROLE_GROUPS } from '@/config/roles';

export const POST = apiHandler(async (_request, params, body) => {
    const approvalId = body.approvalId as string | undefined;
    const status = body.status as string | undefined;
    const comments = body.comments as string | undefined;
    const userId = params._userId;

    if (!approvalId || !status || !userId) {
        throw AppError.badRequest('approvalId, status, and authenticated session are required');
    }

    try {
        const updated = await WorkflowEngine.submitApproval(approvalId, status, userId, comments);
        return { success: true, approval: updated };
    } catch (error: unknown) {
        const err = error as { message?: string };
        throw AppError.internal(err?.message || 'Failed to submit approval');
    }
}, {
    roles: ROLE_GROUPS.PROJECT_WORKFLOW_APPROVERS,
    audit: { action: 'SUBMIT_APPROVAL', entity: 'WORKFLOW' },
    rawResponse: true
});
