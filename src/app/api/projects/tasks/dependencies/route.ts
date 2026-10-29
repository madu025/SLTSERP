import { apiHandler } from '@/lib/api-handler';
import { ProjectTaskService } from '@/services/project/project-task.service';
import { AppError } from '@/lib/error';
import { z } from 'zod';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { assertProjectAccess } from '@/lib/project-access';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (request, params) => {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');
    if (!taskId) throw AppError.badRequest('taskId is required');

    return await ProjectTaskService.getDependencies(taskId, params._userId);
}, { permissions: [RBAC_PERMISSIONS.PROJECT_READ], rawResponse: true });

const createDependencySchema = z.object({
    taskId: z.string().min(1),
    dependsOnTaskId: z.string().min(1),
    type: z.string().optional(),
    dependencyType: z.string().optional(),
    lagDays: z.coerce.number().int().optional(),
}).transform(({ type, dependencyType, ...data }) => ({
    ...data,
    type: type ?? dependencyType,
}));

export const POST = apiHandler(async (_request, params, body) => {
    const data = createDependencySchema.parse(body);
    const task = await ProjectTaskService.getTaskProjectId(data.taskId);
    await assertProjectAccess(task.projectId, params._userId);

    try {
        const dependency = await ProjectTaskService.createDependency(data, params._userId);
        return Response.json(dependency, { status: 201 });
    } catch (error: unknown) {
        if (error instanceof Error) {
            if (error.message === 'SELF_DEPENDENCY') throw AppError.badRequest('A task cannot depend on itself');
            if (error.message === 'DEPENDENCY_EXISTS') throw AppError.badRequest('This dependency already exists');
        }
        throw error;
    }
}, {
    permissions: [RBAC_PERMISSIONS.PROJECT_PLAN_WRITE],
    audit: { action: 'CREATE', entity: 'TASK_DEPENDENCY' },
    rawResponse: true
});

export const DELETE = apiHandler(async (request, params) => {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) throw AppError.badRequest('Dependency ID is required');

    const task = await ProjectTaskService.getDependencyProjectId(id);
    await assertProjectAccess(task.projectId, params._userId);
    await ProjectTaskService.deleteDependency(id);
    return { success: true };
}, {
    permissions: [RBAC_PERMISSIONS.PROJECT_PLAN_WRITE],
    audit: { action: 'DELETE', entity: 'TASK_DEPENDENCY' },
    rawResponse: true
});
