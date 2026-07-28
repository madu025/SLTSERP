import { ROLE_GROUPS } from '@/config/roles';
import { apiHandler } from '@/lib/api-handler';
import { ProjectTaskService } from '@/services/project-task.service';

export const dynamic = 'force-dynamic';

// GET /api/projects/tasks?projectId=xxx (rawResponse for compatibility)
export const GET = apiHandler(async (req) => {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');
    const parentId = searchParams.get('parentId');

    if (!projectId) {
        throw new Error('projectId is required');
    }

    return await ProjectTaskService.getTasks(projectId, parentId);
}, {
    rawResponse: true
});

// POST /api/projects/tasks
export const POST = apiHandler(async (req, _params, body) => {
    const projectId = body.projectId as string | undefined;
    const name = body.name as string | undefined;
    const wbsCode = body.wbsCode as string | undefined;

    if (!projectId || !name || !wbsCode) {
        throw new Error('projectId, name, and wbsCode are required');
    }

    return await ProjectTaskService.createTask(body as any);
}, {
    roles: ROLE_GROUPS.PROJECT_MANAGERS,
    audit: { action: 'CREATE', entity: 'PROJECT_TASK' },
    rawResponse: true
});

// PATCH /api/projects/tasks
export const PATCH = apiHandler(async (req, _params, body) => {
    const id = body.id as string | undefined;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _id, ...updateData } = body;

    if (!id) {
        throw new Error('Task ID is required');
    }

    return await ProjectTaskService.updateTask(id, updateData as any);
}, {
    roles: ROLE_GROUPS.PROJECT_MANAGERS,
    audit: { action: 'UPDATE', entity: 'PROJECT_TASK' },
    rawResponse: true
});

// DELETE /api/projects/tasks?id=xxx
export const DELETE = apiHandler(async (req) => {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
        throw new Error('Task ID is required');
    }

    await ProjectTaskService.deleteTask(id);
    return { success: true };
}, {
    roles: ROLE_GROUPS.PROJECT_MANAGERS,
    audit: { action: 'DELETE', entity: 'PROJECT_TASK' },
    rawResponse: true
});
