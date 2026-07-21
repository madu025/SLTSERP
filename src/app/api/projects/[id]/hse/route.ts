import { apiHandler } from '@/lib/api-handler';
import { ProjectHSEService } from '@/services/project/project-hse.service';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (_request, params) => {
    const { id: projectId } = params;
    const safetyLogs = await ProjectHSEService.getSafetyLogs(projectId);
    return { safetyLogs };
}, { rawResponse: true });

export const POST = apiHandler(async (_request, params, body) => {
    const { id: projectId } = params;
    const { logType, title, recordedById } = body || {};

    if (!logType || !title || !recordedById) {
        throw AppError.badRequest('Missing required fields: logType, title, recordedById');
    }

    const safetyLog = await ProjectHSEService.createSafetyLog(projectId, {
        logType: logType as string,
        title: title as string,
        description: body.description as string | undefined,
        severity: body.severity as string | undefined,
        location: body.location as string | undefined,
        recordedById: recordedById as string,
        attendees: body.attendees
    });
    return Response.json(safetyLog, { status: 201 });
}, {
    audit: { action: 'LOG_HSE_ENTRY', entity: 'PROJECT_HSE' },
    rawResponse: true
});

export const PATCH = apiHandler(async (_request, _params, body) => {
    const { logId, status, correctiveAction, closedById } = body || {};

    if (!logId) {
        throw AppError.badRequest('Log ID is required');
    }

    return await ProjectHSEService.updateSafetyLog(logId as string, { 
        status: status as string | undefined, 
        correctiveAction: correctiveAction as string | undefined, 
        closedById: closedById as string | undefined 
    });
}, {
    audit: { action: 'UPDATE_HSE_LOG', entity: 'PROJECT_HSE' },
    rawResponse: true
});