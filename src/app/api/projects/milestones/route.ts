import { apiHandler } from '@/lib/api-handler';
import { ProjectMilestoneService } from '@/services/project-milestone.service';

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
    const { projectId, name, targetDate } = body;

    if (!projectId || !name || !targetDate) {
        throw new Error('Project ID, Name and Target Date are required');
    }

    return await ProjectMilestoneService.createMilestone(body);
}, {
    roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'OSP_MANAGER', 'AREA_MANAGER'],
    audit: { action: 'CREATE', entity: 'PROJECT_MILESTONE' },
    rawResponse: true
});

// PATCH update milestone
export const PATCH = apiHandler(async (req, _params, body) => {
    const { id, ...updateData } = body;

    if (!id) {
        throw new Error('Milestone ID required');
    }

    return await ProjectMilestoneService.updateMilestone(id, updateData);
}, {
    roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'OSP_MANAGER', 'AREA_MANAGER'],
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
    roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'OSP_MANAGER', 'AREA_MANAGER'],
    audit: { action: 'DELETE', entity: 'PROJECT_MILESTONE' },
    rawResponse: true
});
