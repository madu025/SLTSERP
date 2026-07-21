import { apiHandler } from '@/lib/api-handler';
import { ProjectTaskService } from '@/services/project/project-task.service';
import { AppError } from '@/lib/error';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (request) => {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');

    return await ProjectTaskService.getDependencies(taskId);
}, { rawResponse: true });

const createDependencySchema = z.object({
    taskId: z.string().min(1),
    dependsOnTaskId: z.string().min(1),
    dependencyType: z.string().optional(),
});

export const POST = apiHandler(async (_request, _params, body) => {
    const data = createDependencySchema.parse(body);

    try {
        const dependency = await ProjectTaskService.createDependency(data);
        return Response.json(dependency, { status: 201 });
    } catch (error: unknown) {
        if (error instanceof Error) {
            if (error.message === 'SELF_DEPENDENCY') throw AppError.badRequest('A task cannot depend on itself');
            if (error.message === 'DEPENDENCY_EXISTS') throw AppError.badRequest('This dependency already exists');
        }
        throw error;
    }
}, {
    audit: { action: 'CREATE', entity: 'TASK_DEPENDENCY' },
    rawResponse: true
});

export const DELETE = apiHandler(async (request) => {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) throw AppError.badRequest('Dependency ID is required');

    await ProjectTaskService.deleteDependency(id);
    return { success: true };
}, {
    audit: { action: 'DELETE', entity: 'TASK_DEPENDENCY' },
    rawResponse: true
});
