import { apiHandler } from '@/lib/api-handler';
import { ProjectRequisitionService } from '@/services/project-requisition.service';

export const dynamic = 'force-dynamic';

// GET /api/projects/requisitions?projectId=xxx - List requisitions by project
export const GET = apiHandler(async (req) => {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
        throw new Error('projectId is required');
    }

    return await ProjectRequisitionService.getRequisitions(projectId);
}, {
    rawResponse: true
});

// POST /api/projects/requisitions - Create a new requisition with items
export const POST = apiHandler(async (req, _params, body) => {
    const { projectId, title, items } = body;
    const userId = req.headers.get('x-user-id');

    if (!projectId || !title || !userId || !items?.length) {
        throw new Error('projectId, title, and items are required and user must be authenticated');
    }

    const payload = {
        ...body,
        requestedById: userId
    };

    return await ProjectRequisitionService.createRequisition(payload);
}, {
    roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'OSP_MANAGER', 'AREA_MANAGER'],
    audit: { action: 'CREATE', entity: 'PROJECT_REQUISITION' },
    rawResponse: true
});

// PATCH /api/projects/requisitions - Update requisition status
export const PATCH = apiHandler(async (req, _params, body) => {
    const { id, status, rejectionReason } = body;
    const userId = req.headers.get('x-user-id') || undefined;

    if (!id || !status) {
        throw new Error('id and status are required');
    }

    return await ProjectRequisitionService.updateRequisitionStatus(id, status, userId, rejectionReason);
}, {
    roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'OSP_MANAGER', 'AREA_MANAGER'],
    audit: { action: 'UPDATE_STATUS', entity: 'PROJECT_REQUISITION' },
    rawResponse: true
});

// DELETE /api/projects/requisitions - Delete a requisition (DRAFT only)
export const DELETE = apiHandler(async (req) => {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
        throw new Error('id is required');
    }

    await ProjectRequisitionService.deleteRequisition(id);
    return { message: 'Requisition deleted successfully' };
}, {
    roles: ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'OSP_MANAGER', 'AREA_MANAGER'],
    audit: { action: 'DELETE', entity: 'PROJECT_REQUISITION' },
    rawResponse: true
});
