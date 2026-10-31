import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { apiHandler } from '@/lib/api-handler';
import { assertProjectAccess } from '@/lib/project-access';
import { assertRecordProjectAccess } from '@/lib/project-record-access';
import { AppError } from '@/lib/error';
import { ProjectMilestoneService } from '@/services/project/project-milestone.service';
import { z } from 'zod';

const dateInput = z.union([z.string(), z.date()]);
const createSchema = z.object({
    projectId: z.string().min(1), name: z.string().min(1), targetDate: dateInput,
    description: z.string().optional(), status: z.string().optional(),
});
const updateSchema = z.object({
    name: z.string().optional(), description: z.string().optional(),
    targetDate: dateInput.optional(), completedDate: dateInput.optional(),
    status: z.string().optional(), progress: z.number().optional(),
});

export const dynamic = 'force-dynamic';

// GET list milestones for a project (rawResponse for compatibility)
export const GET = apiHandler(async (req, params) => {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
        throw AppError.badRequest('projectId query parameter is required');
    }

    await assertProjectAccess(projectId, params._userId);
    return await ProjectMilestoneService.getMilestones(projectId);
}, {
    permissions: [RBAC_PERMISSIONS.PROJECT_READ],
    rawResponse: true
});

// POST create milestone
export const POST = apiHandler(async (req, params, body) => {
    const projectId = body.projectId as string | undefined;
    const name = body.name as string | undefined;
    const targetDate = body.targetDate as string | Date | undefined;

    if (!projectId || !name || !targetDate) {
        throw AppError.badRequest('Project ID, Name and Target Date are required');
    }

    await assertProjectAccess(projectId, params._userId);
    return await ProjectMilestoneService.createMilestone(createSchema.parse(body));
}, {
    permissions: [RBAC_PERMISSIONS.PROJECT_WRITE],
    audit: { action: 'CREATE', entity: 'PROJECT_MILESTONE' },
    rawResponse: true
});

// PATCH update milestone
export const PATCH = apiHandler(async (req, params, body) => {
    const id = body.id as string | undefined;

    if (!id) {
        throw AppError.badRequest('Milestone ID required');
    }

    await assertRecordProjectAccess('milestone', id, params._userId);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _id, projectId: _projectId, ...updateData } = body;

    return await ProjectMilestoneService.updateMilestone(id, updateSchema.parse(updateData));
}, {
    permissions: [RBAC_PERMISSIONS.PROJECT_WRITE],
    audit: { action: 'UPDATE', entity: 'PROJECT_MILESTONE' },
    rawResponse: true
});

// DELETE milestone
export const DELETE = apiHandler(async (req, params) => {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
        throw AppError.badRequest('Milestone ID required');
    }

    await assertRecordProjectAccess('milestone', id, params._userId);
    await ProjectMilestoneService.deleteMilestone(id);
    return { success: true };
}, {
    permissions: [RBAC_PERMISSIONS.PROJECT_WRITE],
    audit: { action: 'DELETE', entity: 'PROJECT_MILESTONE' },
    rawResponse: true
});
