import { apiHandler } from '@/lib/api-handler';
import { ProjectTimesheetService } from '@/services/project/project-timesheet.service';
import { AppError } from '@/lib/error';
import { z } from 'zod';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { prisma } from '@/lib/prisma';
import { assertProjectAccess } from '@/lib/project-access';
import { assertRecordProjectAccess, getAccessibleProjectIds, requireAnyPermission } from '@/lib/project-record-access';

const TIMESHEET_APPROVAL_STATUSES = new Set(['APPROVED', 'REJECTED']);

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (request, params) => {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const taskId = searchParams.get('taskId');
    const date = searchParams.get('date');

    if (projectId) {
        await assertProjectAccess(projectId, params._userId);
        return await ProjectTimesheetService.getTimesheets(projectId, taskId, date);
    }

    // No project filter: restrict to projects inside the caller's OPMC scope.
    const accessible = await getAccessibleProjectIds(params._userId);
    const rows = await ProjectTimesheetService.getTimesheets(null, taskId, date);
    return accessible === undefined ? rows : rows.filter((r) => accessible.has(r.projectId));
}, { permissions: [RBAC_PERMISSIONS.PROJECT_READ], rawResponse: true });

const createTimesheetSchema = z.object({
    projectId: z.string().min(1),
    taskId: z.string().min(1),
    staffId: z.string().optional().nullable(),
    contractorId: z.string().optional().nullable(),
    date: z.string().optional().nullable(),
    hours: z.number().min(0).max(24),
    description: z.string().optional().nullable(),
});

export const POST = apiHandler(async (_request, params, body) => {
    const data = createTimesheetSchema.parse(body);
    await assertProjectAccess(data.projectId, params._userId);
    const task = await prisma.projectTask.findUnique({ where: { id: data.taskId }, select: { projectId: true } });
    if (!task || task.projectId !== data.projectId) throw AppError.badRequest('Task does not belong to the project');

    if (data.hours <= 0 || data.hours > 24) {
        throw AppError.badRequest('Hours must be between 0 and 24');
    }

    const timesheet = await ProjectTimesheetService.createTimesheet(data);
    return Response.json(timesheet, { status: 201 });
}, {
    permissions: [RBAC_PERMISSIONS.PROJECT_WRITE],
    audit: { action: 'CREATE', entity: 'TIMESHEET' },
    rawResponse: true
});

const patchTimesheetSchema = z.object({
    id: z.string().min(1),
    status: z.string().min(1),
    verifiedById: z.string().optional().nullable(),
});

export const PATCH = apiHandler(async (_request, params, body) => {
    const data = patchTimesheetSchema.parse(body);
    await assertRecordProjectAccess('timesheet', data.id, params._userId);
    if (TIMESHEET_APPROVAL_STATUSES.has(data.status)) {
        await requireAnyPermission(params._userId, [RBAC_PERMISSIONS.PROJECT_APPROVE], 'project.approve is required to approve or reject a timesheet');
    }
    return await ProjectTimesheetService.updateTimesheetStatus(data.id, data.status, params._userId);
}, {
    permissions: [RBAC_PERMISSIONS.PROJECT_WRITE, RBAC_PERMISSIONS.PROJECT_APPROVE],
    audit: { action: 'UPDATE', entity: 'TIMESHEET' },
    rawResponse: true
});
