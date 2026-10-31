import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { assertProjectAccess } from '@/lib/project-access';
import { assertRecordProjectAccess, requireAnyPermission } from '@/lib/project-record-access';

const PR_APPROVAL_STATUSES = new Set(['APPROVED', 'REJECTED']);
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { ProjectRequisitionService } from '@/services/project/project-requisition.service';
import { z } from 'zod';

const createRequisitionSchema = z.object({
    projectId: z.string().min(1), title: z.string().min(1), description: z.string().optional(),
    priority: z.string().optional(), type: z.string().optional(), deliveryLocation: z.string().optional(),
    requiredDate: z.string().optional(), vendorId: z.string().nullable().optional(), remarks: z.string().optional(),
    items: z.array(z.object({
        boqItemId: z.string().nullable().optional(), itemCode: z.string().min(1), description: z.string().min(1),
        unit: z.string().optional(), quantity: z.number().positive(), estimatedPrice: z.number().min(0),
        notes: z.string().nullable().optional(),
    })).min(1),
});

export const dynamic = 'force-dynamic';

// GET /api/projects/requisitions?projectId=xxx - List requisitions by project
export const GET = apiHandler(async (req, params) => {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
        throw AppError.badRequest('projectId is required');
    }

    await assertProjectAccess(projectId, params._userId);
    return await ProjectRequisitionService.getRequisitions(projectId);
}, {
    permissions: [RBAC_PERMISSIONS.PROJECT_READ],
    rawResponse: true
});

// POST /api/projects/requisitions - Create a new requisition with items
export const POST = apiHandler(async (req, params, body) => {
    const data = createRequisitionSchema.parse(body);
    const { projectId } = data;
    const userId = params._userId;

    if (!userId) throw AppError.unauthorized('Authentication required');

    await assertProjectAccess(projectId, userId);

    const payload = {
        ...data,
        requestedById: userId
    };

    return await ProjectRequisitionService.createRequisition(payload);
}, {
    permissions: [RBAC_PERMISSIONS.PROJECT_WRITE],
    audit: { action: 'CREATE', entity: 'PROJECT_REQUISITION' },
    rawResponse: true
});

// PATCH /api/projects/requisitions - Update requisition status
export const PATCH = apiHandler(async (req, params, body) => {
    const id = body.id as string | undefined;
    const status = body.status as string | undefined;
    const rejectionReason = body.rejectionReason as string | undefined;
    const userId = params._userId || undefined;

    if (!id || !status) {
        throw AppError.badRequest('id and status are required');
    }

    await assertRecordProjectAccess('requisition', id, userId);
    if (PR_APPROVAL_STATUSES.has(status)) {
        await requireAnyPermission(userId, [RBAC_PERMISSIONS.PROJECT_APPROVE], 'project.approve is required to approve or reject a requisition');
    }

    return await ProjectRequisitionService.updateRequisitionStatus(id, status, userId, rejectionReason);
}, {
    permissions: [RBAC_PERMISSIONS.PROJECT_WRITE, RBAC_PERMISSIONS.PROJECT_APPROVE],
    audit: { action: 'UPDATE_STATUS', entity: 'PROJECT_REQUISITION' },
    rawResponse: true
});

// DELETE /api/projects/requisitions - Delete a requisition (DRAFT only)
export const DELETE = apiHandler(async (req, params) => {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
        throw AppError.badRequest('id is required');
    }

    await assertRecordProjectAccess('requisition', id, params._userId);
    await ProjectRequisitionService.deleteRequisition(id);
    return { message: 'Requisition deleted successfully' };
}, {
    permissions: [RBAC_PERMISSIONS.PROJECT_WRITE],
    audit: { action: 'DELETE', entity: 'PROJECT_REQUISITION' },
    rawResponse: true
});
