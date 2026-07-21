import { apiHandler } from '@/lib/api-handler';
import { ProjectTaskService } from '@/services/project/project-task.service';
import { AppError } from '@/lib/error';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (request) => {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');
    if (!taskId) throw AppError.badRequest('taskId is required');

    return await ProjectTaskService.getProgressLogs(taskId);
}, { rawResponse: true });

const logProgressSchema = z.object({
    taskId: z.string().min(1),
    progress: z.number().min(0).max(100),
    notes: z.string().optional().nullable(),
    loggedById: z.string().optional().nullable(),
    logDate: z.string().optional().nullable(),
});

export const POST = apiHandler(async (_request, _params, body) => {
    const data = logProgressSchema.parse(body);

    try {
        const log = await ProjectTaskService.logProgress(data);
        return Response.json(log, { status: 201 });
    } catch (error: unknown) {
        if (error instanceof Error) {
            if (error.message === 'INVALID_PROGRESS_RANGE') {
                throw AppError.badRequest('Progress must be a number between 0 and 100');
            }
        }
        throw error;
    }
}, {
    audit: { action: 'UPDATE', entity: 'TASK_PROGRESS' },
    rawResponse: true
});
