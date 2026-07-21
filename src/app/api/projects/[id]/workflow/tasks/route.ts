import { apiHandler } from '@/lib/api-handler';
import { WorkflowEngine } from '@/services/WorkflowEngine';
import { AppError } from '@/lib/error';

export const POST = apiHandler(async (_request, _params, body) => {
    const { action } = body || {};

    try {
        if (action === 'update_task') {
            const { taskId, status, progress } = body;
            if (!taskId || !status) {
                throw AppError.badRequest('taskId and status are required');
            }
            const updated = await WorkflowEngine.updateTaskStatus(taskId, status, progress);
            return { success: true, task: updated };
        }

        if (action === 'update_checklist') {
            const { checklistId, isCompleted, photoUrl } = body;
            if (!checklistId) {
                throw AppError.badRequest('checklistId is required');
            }
            const updated = await WorkflowEngine.updateChecklistItem(checklistId, isCompleted, photoUrl);
            return { success: true, checklist: updated };
        }

        throw AppError.badRequest('Invalid action parameter');
    } catch (error: unknown) {
        const err = error as { message?: string };
        const msg = err?.message || 'Failed to update details';
        
        if (msg === 'taskId and status are required' || msg === 'checklistId is required' || msg === 'Invalid action parameter') {
            throw error; // Let apiHandler handle AppError
        }
        
        throw AppError.internal(msg);
    }
}, {
    audit: { action: 'UPDATE_TASK', entity: 'WORKFLOW' },
    rawResponse: true
});
