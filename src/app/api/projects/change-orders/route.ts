import { apiHandler } from '@/lib/api-handler';
import { ProjectChangeOrderService } from '@/services/project/project-change-order.service';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { assertProjectAccess } from '@/lib/project-access';
import { assertRecordProjectAccess, requireAnyPermission } from '@/lib/project-record-access';
import { z } from 'zod';

const CO_APPROVAL_ACTIONS = new Set(['APPROVE', 'APPROVED', 'REJECT', 'REJECTED', 'IMPLEMENT', 'IMPLEMENTED']);
const createChangeOrderSchema = z.object({
    projectId: z.string().min(1), title: z.string().min(1), description: z.string().nullable().optional(),
    type: z.string().optional(), priority: z.string().optional(), reason: z.string().nullable().optional(),
    referenceTable: z.string().nullable().optional(), referenceId: z.string().nullable().optional(),
    originalValue: z.number().nullable().optional(), newValue: z.number().nullable().optional(),
    costImpact: z.number().optional(), timeImpact: z.number().nullable().optional(),
    scopeImpact: z.string().nullable().optional(), riskAssessment: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
});

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (request, params) => {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
        throw AppError.badRequest('projectId is required');
    }

    await assertProjectAccess(projectId, params._userId);
    return await ProjectChangeOrderService.getChangeOrders(projectId);
}, { permissions: [RBAC_PERMISSIONS.PROJECT_READ], rawResponse: true });

export const POST = apiHandler(async (_request, params, body) => {
    const data = createChangeOrderSchema.parse(body);
    const { projectId } = data;

    await assertProjectAccess(projectId, params._userId);

    try {
        const changeOrder = await ProjectChangeOrderService.createChangeOrder({
            ...data,
            requestedById: params._userId,
        });
        return Response.json(changeOrder, { status: 201 });
    } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : '';
        if (errorMsg === 'PROJECT_NOT_FOUND') {
            throw AppError.notFound('Project not found');
        }
        throw error;
    }
}, {
    permissions: [RBAC_PERMISSIONS.PROJECT_WRITE],
    audit: { action: 'CREATE', entity: 'CHANGE_ORDER' },
    rawResponse: true
});

export const PATCH = apiHandler(async (_request, params, body) => {
    const coId = body.coId as string | undefined;
    const status = body.status as string | undefined;
    const rejectionReason = body.rejectionReason as string | undefined;

    if (!coId || !status) {
        throw AppError.badRequest('id and status are required');
    }

    await assertRecordProjectAccess('changeOrder', coId, params._userId);
    if (status && CO_APPROVAL_ACTIONS.has(status)) {
        await requireAnyPermission(params._userId, [RBAC_PERMISSIONS.PROJECT_APPROVE], 'project.approve is required to approve, reject or implement a change order');
    }

    try {
        return await ProjectChangeOrderService.updateChangeOrder(coId, status, {
            approvedById: status === 'APPROVED' || status === 'APPROVE' ? params._userId : undefined,
            implementedById: status === 'IMPLEMENTED' || status === 'IMPLEMENT' ? params._userId : undefined,
            rejectionReason
        });
    } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : '';
        
        switch (errorMsg) {
            case 'CHANGE_ORDER_NOT_FOUND':
                throw AppError.notFound('Change order not found');
            case 'INVALID_STATUS_DRAFT_ONLY':
                throw AppError.badRequest('Only DRAFT can be submitted');
            case 'INVALID_STATUS_PENDING_ONLY':
                throw AppError.badRequest('Only PENDING_APPROVAL can be approved or rejected');
            case 'INVALID_STATUS_APPROVED_ONLY':
                throw AppError.badRequest('Only APPROVED can be implemented');
            case 'CANNOT_CANCEL_COMPLETED':
                throw AppError.badRequest('Cannot cancel an implemented or already cancelled change order');
            case 'CAN_ONLY_UPDATE_DRAFT_PENDING':
                throw AppError.badRequest('Can only update DRAFT or PENDING_APPROVAL change orders');
            case 'INVALID_ACTION':
                throw AppError.badRequest('Invalid action. Use SUBMIT, APPROVE, REJECT, IMPLEMENT, CANCEL, or UPDATE');
            default:
                throw error;
        }
    }
}, {
    permissions: [RBAC_PERMISSIONS.PROJECT_WRITE, RBAC_PERMISSIONS.PROJECT_APPROVE],
    audit: { action: 'UPDATE', entity: 'CHANGE_ORDER' },
    rawResponse: true
});

export const DELETE = apiHandler(async (request, params) => {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
        throw AppError.badRequest('id is required');
    }

    await assertRecordProjectAccess('changeOrder', id, params._userId);

    try {
        await ProjectChangeOrderService.deleteChangeOrder(id);
        return { message: 'Change order deleted' };
    } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : '';
        if (errorMsg === 'CHANGE_ORDER_NOT_FOUND') {
            throw AppError.notFound('Change order not found');
        }
        if (errorMsg === 'DRAFT_ONLY_DELETION') {
            throw AppError.badRequest('Only DRAFT change orders can be deleted');
        }
        throw error;
    }
}, {
    permissions: [RBAC_PERMISSIONS.PROJECT_WRITE],
    audit: { action: 'DELETE', entity: 'CHANGE_ORDER' },
    rawResponse: true
});
