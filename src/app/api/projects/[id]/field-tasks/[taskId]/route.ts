import { apiHandler } from '@/lib/api-handler';
import { FieldTaskService } from '@/services/field-task.service';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (_request, params) => {
    const { id: projectId, taskId } = await params;
    return await FieldTaskService.getFieldTask(projectId, taskId);
}, { rawResponse: true });

export const PATCH = apiHandler(async (_request, params, body) => {
    const { id: projectId, taskId } = await params;
    return await FieldTaskService.updateFieldTask(
        projectId, 
        taskId, 
        (body || {}) as unknown as Parameters<typeof FieldTaskService.updateFieldTask>[2]
    );
}, {
    audit: { action: 'UPDATE', entity: 'FIELD_TASK' },
    rawResponse: true
});

export const DELETE = apiHandler(async (_request, params) => {
    const { id: projectId, taskId } = await params;
    await FieldTaskService.deleteFieldTask(projectId, taskId);
    return { success: true };
}, {
    audit: { action: 'DELETE', entity: 'FIELD_TASK' },
    rawResponse: true
});
