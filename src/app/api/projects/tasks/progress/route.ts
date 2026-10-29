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

    return await ProjectTaskService.getProgressLogs(taskId, params._userId);
}, { rawResponse: true });

const logProgressSchema = z.object({
    taskId: z.string().min(1),
    projectId: z.string().uuid(),
    progress: z.coerce.number().min(0).max(100),
    description: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
    photoUrls: z.array(z.string()).optional(),
    gpsLatitude: z.coerce.number().optional().nullable(),
    gpsLongitude: z.coerce.number().optional().nullable(),
    loggedById: z.string().optional().nullable(),
    logDate: z.string().optional().nullable(),
});

export const POST = apiHandler(async (_request, params, body) => {
    const data = logProgressSchema.parse(body);

    try {
        await assertProjectAccess(data.projectId, params._userId);
        const log = await ProjectTaskService.logProgress({
        ...data,
            description: data.description ?? data.notes,
            loggedById: params._userId,
        });
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
    permissions: [RBAC_PERMISSIONS.PROJECT_PLAN_WRITE],
    audit: { action: 'UPDATE', entity: 'TASK_PROGRESS' },
    rawResponse: true
});
