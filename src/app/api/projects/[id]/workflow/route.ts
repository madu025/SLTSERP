import { apiHandler } from '@/lib/api-handler';
import { ProjectWorkflowService } from '@/services/project-workflow.service';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

// GET /api/projects/[id]/workflow
export const GET = apiHandler(async (_request, params) => {
    const { id } = await params;
    const workflowInstance = await ProjectWorkflowService.getWorkflow(id);

    if (!workflowInstance) {
        throw AppError.notFound('No active workflow found and could not auto-initialize');
    }

    return workflowInstance;
}, { rawResponse: true });

// POST /api/projects/[id]/workflow - Initialize workflow manually
export const POST = apiHandler(async (_request, params, body) => {
    const { id } = await params;
    const { projectTypeId } = body || {};

    if (!projectTypeId) {
        throw AppError.badRequest('projectTypeId is required');
    }

    try {
        const workflowInstance = await ProjectWorkflowService.initializeWorkflow(id, projectTypeId);
        return { success: true, workflowInstance };
    } catch (error: unknown) {
        const err = error as { message?: string };
        if (err?.message === 'WORKFLOW_ALREADY_INITIALIZED') {
            throw AppError.badRequest('Workflow already initialized for this project');
        }
        throw error;
    }
}, {
    audit: { action: 'INITIALIZE_WORKFLOW', entity: 'Project' },
    rawResponse: true
});
