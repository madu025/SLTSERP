import { ROLE_GROUPS } from '@/config/roles';
import { apiHandler } from '@/lib/api-handler';
import { ProjectMilestoneService } from '@/services/project/project-milestone.service';

export const dynamic = 'force-dynamic';

// GET list milestones for a project (rawResponse for compatibility)
export const GET = apiHandler(async (req) => {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
        throw new Error('projectId query parameter is required');
    }

    return await ProjectMilestoneService.getMilestones(projectId);
}, {
    rawResponse: true
});

// POST create milestone
export const POST = apiHandler(async (req, _params, body) => {
    const projectId = body.projectId as string | undefined;
    const name = body.name as string | undefined;
    const targetDate = body.targetDate as string | Date | undefined;

    if (!projectId || !name || !targetDate) {
        throw new Error('Project ID, Name and Target Date are required');
    }

    return await ProjectMilestoneService.createMilestone(body as any);
}, {
    roles: ROLE_GROUPS.PROJECT_MANAGERS,
    audit: { action: 'CREATE', entity: 'PROJECT_MILESTONE' },
    rawResponse: true
});

// PATCH update milestone
export const PATCH = apiHandler(async (req, _params, body) => {
    const id = body.id as string | undefined;

    if (!id) {
        throw new Error('Milestone ID required');
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _id, ...updateData } = body;

    return await ProjectMilestoneService.updateMilestone(id, updateData as any);
}, {
    roles: ROLE_GROUPS.PROJECT_MANAGERS,
    audit: { action: 'UPDATE', entity: 'PROJECT_MILESTONE' },
    rawResponse: true
});

// DELETE milestone
export const DELETE = apiHandler(async (req) => {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
        throw new Error('Milestone ID required');
    }

    await ProjectMilestoneService.deleteMilestone(id);
    return { success: true };
}, {
    roles: ROLE_GROUPS.PROJECT_MANAGERS,
    audit: { action: 'DELETE', entity: 'PROJECT_MILESTONE' },
    rawResponse: true
});
