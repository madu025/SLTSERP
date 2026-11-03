import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { apiHandler } from '@/lib/api-handler';
import { assertProjectAccess } from '@/lib/project-access';
import { AppError } from '@/lib/error';
import { CreateTaskInput, ProjectTaskService, UpdateTaskInput } from '@/services/project/project-task.service';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const optionalText = (max: number) => z.string().trim().max(max).optional();
const optionalNullableText = (max: number) => z.string().trim().max(max).optional().nullable();
const optionalNumber = z.union([z.number().finite(), z.string().trim().max(32)]).optional().nullable();
const optionalDate = z.string().trim().max(40).optional().nullable();
const taskFields = {
    parentId: optionalNullableText(100),
    wbsCode: optionalText(50),
    name: z.string().trim().min(1).max(300),
    description: optionalText(5000),
    type: optionalText(50),
    plannedStartDate: optionalDate,
    plannedEndDate: optionalDate,
    plannedDuration: optionalNumber,
    priority: optionalText(32),
    estimatedCost: optionalNumber,
    order: z.number().int().min(0).max(1_000_000).optional(),
    assigneeType: optionalText(32),
    assigneeId: optionalText(100),
    contractorId: optionalNullableText(100),
    contractorAssignmentId: optionalNullableText(100),
};
const createTaskSchema = z.object({ projectId: z.string().uuid(), ...taskFields }).strict();
const updateTaskSchema = z.object({
    ...taskFields,
    actualStartDate: optionalDate,
    actualEndDate: optionalDate,
    status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'DELAYED']).optional(),
    actualProgress: z.number().finite().min(0).max(100).optional(),
}).partial().extend({
    id: z.string().uuid(),
    projectId: z.string().uuid(),
}).strict();

// GET /api/projects/tasks?projectId=xxx (rawResponse for compatibility)
export const GET = apiHandler(async (req, params) => {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');
    const parentId = searchParams.get('parentId');

    if (!projectId) {
        throw AppError.badRequest('projectId is required');
    }
    await assertProjectAccess(projectId, params._userId);

    return await ProjectTaskService.getTasks(projectId, parentId, params._userId);
}, {
    rawResponse: true
});

// POST /api/projects/tasks
export const POST = apiHandler<unknown, CreateTaskInput>(async (req, params, body) => {
    const projectId = body.projectId;
    const name = body.name;

    if (!projectId || !name?.trim()) {
        throw AppError.badRequest('projectId and name are required');
    }
    await assertProjectAccess(projectId, params._userId);

    return await ProjectTaskService.createTask(body, params._userId);
}, {
    schema: createTaskSchema,
    permissions: [RBAC_PERMISSIONS.PROJECT_PLAN_WRITE],
    audit: { action: 'CREATE', entity: 'PROJECT_TASK' },
    rawResponse: true
});

// PATCH /api/projects/tasks
export const PATCH = apiHandler<unknown, UpdateTaskInput & { id: string; projectId: string }>(async (req, _params, body) => {
    const id = body.id;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _id, projectId: _projectId, ...updateData } = body;

    if (!id) {
        throw AppError.badRequest('Task ID is required');
    }

    if (!body.projectId) throw AppError.badRequest('projectId is required for task updates');
    return await ProjectTaskService.updateTask(id, updateData, body.projectId, _params._userId);
}, {
    schema: updateTaskSchema,
    permissions: [RBAC_PERMISSIONS.PROJECT_PLAN_WRITE],
    audit: { action: 'UPDATE', entity: 'PROJECT_TASK' },
    rawResponse: true
});

// DELETE /api/projects/tasks?id=xxx
export const DELETE = apiHandler(async (req, params) => {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const projectId = searchParams.get('projectId');

    if (!id) {
        throw AppError.badRequest('Task ID is required');
    }

    if (!projectId) throw AppError.badRequest('projectId is required for task deletion');
    await ProjectTaskService.deleteTask(id, projectId, params._userId);
    return { success: true };
}, {
    permissions: [RBAC_PERMISSIONS.PROJECT_PLAN_WRITE],
    audit: { action: 'DELETE', entity: 'PROJECT_TASK' },
    rawResponse: true
});
