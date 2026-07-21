import { apiHandler } from '@/lib/api-handler';
import { ProjectTimesheetService } from '@/services/project/project-timesheet.service';
import { AppError } from '@/lib/error';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (request) => {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const taskId = searchParams.get('taskId');
    const date = searchParams.get('date');

    return await ProjectTimesheetService.getTimesheets(projectId, taskId, date);
}, { rawResponse: true });

const createTimesheetSchema = z.object({
    projectId: z.string().min(1),
    taskId: z.string().min(1),
    staffId: z.string().optional().nullable(),
    contractorId: z.string().optional().nullable(),
    date: z.string().optional().nullable(),
    hours: z.number().min(0).max(24),
    description: z.string().optional().nullable(),
});

export const POST = apiHandler(async (_request, _params, body) => {
    const data = createTimesheetSchema.parse(body);

    if (data.hours <= 0 || data.hours > 24) {
        throw AppError.badRequest('Hours must be between 0 and 24');
    }

    const timesheet = await ProjectTimesheetService.createTimesheet(data);
    return Response.json(timesheet, { status: 201 });
}, {
    audit: { action: 'CREATE', entity: 'TIMESHEET' },
    rawResponse: true
});

const patchTimesheetSchema = z.object({
    id: z.string().min(1),
    status: z.string().min(1),
    verifiedById: z.string().optional().nullable(),
});

export const PATCH = apiHandler(async (_request, _params, body) => {
    const data = patchTimesheetSchema.parse(body);
    return await ProjectTimesheetService.updateTimesheetStatus(data.id, data.status, data.verifiedById);
}, {
    audit: { action: 'UPDATE', entity: 'TIMESHEET' },
    rawResponse: true
});
