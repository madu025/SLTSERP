import { apiHandler } from '@/lib/api-handler';
import { ProjectWorkflowService } from '@/services/project/project-workflow.service';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { assertProjectAccess } from '@/lib/project-access';

export const dynamic = 'force-dynamic';

// GET /api/projects/[id]/workflow
export const GET = apiHandler(async (_request, params) => {
    await assertProjectAccess(params.id, params._userId);
    const workflowInstance = await ProjectWorkflowService.getWorkflow(params.id);

    if (!workflowInstance) {
        throw AppError.notFound('No active workflow found and could not auto-initialize');
    }

    return workflowInstance;
}, { permissions: [RBAC_PERMISSIONS.PROJECT_READ], rawResponse: true });

// POST /api/projects/[id]/workflow - Initialize workflow manually
export const POST = apiHandler(async (_request, params, body) => {
    await assertProjectAccess(params.id, params._userId);
    const projectTypeId = body.projectTypeId as string | undefined;

    if (!projectTypeId) {
        throw AppError.badRequest('projectTypeId is required');
    }

    try {
        const workflowInstance = await ProjectWorkflowService.initializeWorkflow(params.id, projectTypeId);
        return { success: true, workflowInstance };
    } catch (error: unknown) {
        const err = error as { message?: string };
        if (err?.message === 'WORKFLOW_ALREADY_INITIALIZED') {
            throw AppError.badRequest('Workflow already initialized for this project');
        }
        throw error;
    }
}, {
    permissions: [RBAC_PERMISSIONS.PROJECT_WRITE],
    audit: { action: 'INITIALIZE_WORKFLOW', entity: 'Project' },
    rawResponse: true
});
