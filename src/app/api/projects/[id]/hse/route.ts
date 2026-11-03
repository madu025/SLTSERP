import { apiHandler } from '@/lib/api-handler';
import { ProjectHSEService } from '@/services/project/project-hse.service';
import { assertRecordInProject } from '@/lib/project-record-access';
import { AppError } from '@/lib/error';
import { z } from 'zod';

const attendeesSchema = z.array(z.object({
    name: z.string().trim().min(1).max(200),
    designation: z.string().trim().max(200).optional(),
    signatureUrl: z.string().url().max(2048).optional()
}).strict()).max(500).optional();
const createHseSchema = z.object({
    logType: z.string().trim().min(1).max(50),
    title: z.string().trim().min(1).max(300),
    description: z.string().max(5000).optional(),
    severity: z.string().trim().max(32).optional(),
    location: z.string().trim().max(300).optional(),
    attendees: attendeesSchema,
}).strict();
const updateHseSchema = z.object({
    logId: z.string().min(1),
    status: z.string().trim().max(32).optional(),
    correctiveAction: z.string().max(5000).optional(),
}).strict();

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (_request, params) => {
    const { id: projectId } = params;
    const safetyLogs = await ProjectHSEService.getSafetyLogs(projectId);
    return { safetyLogs };
}, { rawResponse: true });

export const POST = apiHandler(async (_request, params, body) => {
    const { id: projectId } = params;
    const userId = params._userId;
    if (!userId) throw AppError.unauthorized('Authentication required');
    const { logType, title } = body;

    const { description, severity, location, attendees } = body;

    const safetyLog = await ProjectHSEService.createSafetyLog(projectId, {
        logType,
        title,
        description,
        severity,
        location,
        recordedById: userId,
        attendees,
    }, userId);
    return Response.json(safetyLog, { status: 201 });
}, {
    schema: createHseSchema,
    audit: { action: 'LOG_HSE_ENTRY', entity: 'PROJECT_HSE' },
    rawResponse: true
});

export const PATCH = apiHandler(async (_request, params, body) => {
    const userId = params._userId;
    if (!userId) throw AppError.unauthorized('Authentication required');
    const { logId, status, correctiveAction } = body;

    if (!logId) {
        throw AppError.badRequest('Log ID is required');
    }

    await assertRecordInProject('hseLog', logId as string, params.id);
    return await ProjectHSEService.updateSafetyLog(logId as string, { 
        status,
        correctiveAction,
        closedById: status === 'CLOSED' ? userId : undefined,
    }, userId);
}, {
    schema: updateHseSchema,
    audit: { action: 'UPDATE_HSE_LOG', entity: 'PROJECT_HSE' },
    rawResponse: true
});
