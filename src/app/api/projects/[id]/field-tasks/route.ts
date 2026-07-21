import { apiHandler } from '@/lib/api-handler';
import { FieldTaskService } from '@/services/field-task.service';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (_request, params) => {
    const { id: projectId } = await params;
    return await FieldTaskService.getFieldTasks(projectId);
}, { rawResponse: true });

export const POST = apiHandler(async (_request, params, body) => {
    const { id: projectId } = await params;

    if (!body || !body.title) {
        throw AppError.badRequest('title is required');
    }

    return await FieldTaskService.createFieldTask(
        projectId, 
        body as unknown as Parameters<typeof FieldTaskService.createFieldTask>[1]
    );
}, {
    audit: { action: 'CREATE', entity: 'FIELD_TASK' },
    rawResponse: true
});
