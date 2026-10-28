import { ROLE_GROUPS } from '@/config/roles';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { CreateTaskInput, ProjectTaskService, UpdateTaskInput } from '@/services/project/project-task.service';

export const dynamic = 'force-dynamic';

// GET /api/projects/tasks?projectId=xxx (rawResponse for compatibility)
export const GET = apiHandler(async (req, params) => {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');
    const parentId = searchParams.get('parentId');

    if (!projectId) {
        throw AppError.badRequest('projectId is required');
    }

    return await ProjectTaskService.getTasks(projectId, parentId, params._userId, params._userRole);
}, {
    rawResponse: true
});

// POST /api/projects/tasks
export const POST = apiHandler(async (req, _params, body) => {
    const projectId = body.projectId as string | undefined;
    const name = body.name as string | undefined;

    if (!projectId || !name?.trim()) {
        throw AppError.badRequest('projectId and name are required');
    }

    return await ProjectTaskService.createTask(body as unknown as CreateTaskInput);
}, {
    roles: ROLE_GROUPS.PROJECT_MANAGERS,
    audit: { action: 'CREATE', entity: 'PROJECT_TASK' },
    rawResponse: true
});

// PATCH /api/projects/tasks
export const PATCH = apiHandler(async (req, _params, body) => {
    const id = body.id as string | undefined;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _id, projectId: _projectId, ...updateData } = body;

    if (!id) {
        throw AppError.badRequest('Task ID is required');
    }

    if (!body.projectId) throw AppError.badRequest('projectId is required for task updates');
    return await ProjectTaskService.updateTask(id, updateData as unknown as UpdateTaskInput, body.projectId as string, _params._userId);
}, {
    permissions: [RBAC_PERMISSIONS.PROJECT_PLAN_WRITE],
    audit: { action: 'UPDATE', entity: 'PROJECT_TASK' },
    rawResponse: true
});

// DELETE /api/projects/tasks?id=xxx
export const DELETE = apiHandler(async (req, params) => {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const projectId = searchParams.get('projectId');

    if (!id) {
        throw AppError.badRequest('Task ID is required');
    }

    if (!projectId) throw AppError.badRequest('projectId is required for task deletion');
    await ProjectTaskService.deleteTask(id, projectId, params._userId);
    return { success: true };
}, {
    permissions: [RBAC_PERMISSIONS.PROJECT_PLAN_WRITE],
    audit: { action: 'DELETE', entity: 'PROJECT_TASK' },
    rawResponse: true
});
