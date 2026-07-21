import { apiHandler } from '@/lib/api-handler';
import { WorkflowEngine } from '@/services/WorkflowEngine';
import { AppError } from '@/lib/error';

export const POST = apiHandler(async (_request, _params, body) => {
    const { approvalId, status, userId, comments } = body || {};

    if (!approvalId || !status || !userId) {
        throw AppError.badRequest('approvalId, status, and userId are required');
    }

    try {
        const updated = await WorkflowEngine.submitApproval(approvalId, status, userId, comments);
        return { success: true, approval: updated };
    } catch (error: unknown) {
        const err = error as { message?: string };
        throw AppError.internal(err?.message || 'Failed to submit approval');
    }
}, {
    audit: { action: 'SUBMIT_APPROVAL', entity: 'WORKFLOW' },
    rawResponse: true
});
