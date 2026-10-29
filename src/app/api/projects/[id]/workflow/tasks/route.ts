export const dynamic = 'force-dynamic';
import { apiHandler } from '@/lib/api-handler';
import { WorkflowEngine } from '@/services/core/WorkflowEngine';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { assertProjectAccess } from '@/lib/project-access';

export const POST = apiHandler(async (_request, params, body) => {
    await assertProjectAccess(params.id, params._userId);
    const action = body.action as string | undefined;

    try {
        if (action === 'update_task') {
            const taskId = body.taskId as string | undefined;
            const status = body.status as string | undefined;
            const progress = body.progress as number | undefined;
            if (!taskId || !status) {
                throw AppError.badRequest('taskId and status are required');
            }
            const updated = await WorkflowEngine.updateTaskStatus(taskId, status, progress, params.id);
            return { success: true, task: updated };
        }

        if (action === 'update_checklist') {
            const checklistId = body.checklistId as string | undefined;
            const isCompleted = body.isCompleted as boolean | undefined;
            const photoUrl = body.photoUrl === null ? null : body.photoUrl as string | undefined;
            if (!checklistId) {
                throw AppError.badRequest('checklistId is required');
            }
            const updated = await WorkflowEngine.updateChecklistItem(checklistId, isCompleted ?? false, photoUrl, params.id);
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
    permissions: [RBAC_PERMISSIONS.PROJECT_WRITE],
    audit: { action: 'UPDATE_TASK', entity: 'WORKFLOW' },
    rawResponse: true
});
