import { ROLE_GROUPS } from '@/config/roles';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { ProjectRequisitionService } from '@/services/project/project-requisition.service';

export const dynamic = 'force-dynamic';

// GET /api/projects/requisitions?projectId=xxx - List requisitions by project
export const GET = apiHandler(async (req) => {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
        throw AppError.badRequest('projectId is required');
    }

    return await ProjectRequisitionService.getRequisitions(projectId);
}, {
    rawResponse: true
});

// POST /api/projects/requisitions - Create a new requisition with items
export const POST = apiHandler(async (req, _params, body) => {
    const projectId = body.projectId as string | undefined;
    const title = body.title as string | undefined;
    const items = body.items as unknown[] | undefined;
    const userId = req.headers.get('x-user-id');

    if (!projectId || !title || !userId || !items?.length) {
        throw AppError.badRequest('projectId, title, and items are required and user must be authenticated');
    }

    const payload = {
        ...body,
        requestedById: userId
    };

    return await ProjectRequisitionService.createRequisition(payload as any);
}, {
    roles: ROLE_GROUPS.PROJECT_MANAGERS,
    audit: { action: 'CREATE', entity: 'PROJECT_REQUISITION' },
    rawResponse: true
});

// PATCH /api/projects/requisitions - Update requisition status
export const PATCH = apiHandler(async (req, _params, body) => {
    const id = body.id as string | undefined;
    const status = body.status as string | undefined;
    const rejectionReason = body.rejectionReason as string | undefined;
    const userId = req.headers.get('x-user-id') || undefined;

    if (!id || !status) {
        throw AppError.badRequest('id and status are required');
    }

    return await ProjectRequisitionService.updateRequisitionStatus(id, status, userId, rejectionReason);
}, {
    roles: ROLE_GROUPS.PROJECT_MANAGERS,
    audit: { action: 'UPDATE_STATUS', entity: 'PROJECT_REQUISITION' },
    rawResponse: true
});

// DELETE /api/projects/requisitions - Delete a requisition (DRAFT only)
export const DELETE = apiHandler(async (req) => {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
        throw AppError.badRequest('id is required');
    }

    await ProjectRequisitionService.deleteRequisition(id);
    return { message: 'Requisition deleted successfully' };
}, {
    roles: ROLE_GROUPS.PROJECT_MANAGERS,
    audit: { action: 'DELETE', entity: 'PROJECT_REQUISITION' },
    rawResponse: true
});
