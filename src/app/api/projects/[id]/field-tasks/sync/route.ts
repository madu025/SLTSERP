import { apiHandler } from '@/lib/api-handler';
import { FieldTaskService } from '@/services/field-task.service';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

// POST: Sync field task data from mobile device
export const POST = apiHandler(async (_request, params, body) => {
    const { id: projectId } = await params;
    const { tasks, deviceId, appVersion } = body || {};

    if (!tasks || !Array.isArray(tasks)) {
        throw AppError.badRequest('Tasks array is required');
    }

    const results = await FieldTaskService.syncFieldTasks(
        projectId, 
        tasks as unknown as Parameters<typeof FieldTaskService.syncFieldTasks>[1], 
        deviceId as string | undefined, 
        appVersion as string | undefined
    );

    return {
        synced: results.length,
        tasks: results
    };
}, {
    audit: { action: 'SYNC', entity: 'FIELD_TASK' },
    rawResponse: true
});

// GET: Check sync status for pending tasks
export const GET = apiHandler(async (_request, params) => {
    const { id: projectId } = await params;
    return await FieldTaskService.getSyncStatus(projectId);
}, { rawResponse: true });