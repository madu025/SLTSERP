import { apiHandler } from '@/lib/api-handler';
import { ProjectChangeOrderService } from '@/services/project-change-order.service';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (_request, params) => {
    const { id: projectId } = await params;
    return await ProjectChangeOrderService.getChangeOrders(projectId);
}, { rawResponse: true });

export const POST = apiHandler(async (_request, params, body) => {
    const { id: projectId } = await params;
    const {
        title,
        description,
        type,
        reason,
        costImpact,
        timeImpact,
        requestedById,
        notes
    } = body || {};

    if (!title || !type || !requestedById) {
        throw AppError.badRequest('Missing required fields: title, type, requestedById');
    }

    try {
        return await ProjectChangeOrderService.createChangeOrder({
            projectId,
            title,
            description,
            type,
            reason,
            costImpact,
            timeImpact,
            requestedById,
            notes
        });
    } catch (error: unknown) {
        const err = error as { message?: string };
        if (err?.message === 'PROJECT_NOT_FOUND') {
            throw AppError.notFound('Project not found');
        }
        throw error;
    }
}, {
    audit: { action: 'CREATE', entity: 'CHANGE_ORDER' },
    rawResponse: true
});

export const PATCH = apiHandler(async (_request, _params, body) => {
    const { coId, status, approvedById, rejectionReason } = body || {};

    if (!coId) {
        throw AppError.badRequest('Change order ID is required');
    }

    // Map status update to service action
    let action = 'UPDATE';
    if (status === 'APPROVED') {
        action = 'APPROVE';
    } else if (status === 'REJECTED') {
        action = 'REJECT';
    } else if (status === 'PENDING_APPROVAL') {
        action = 'SUBMIT';
    } else if (status === 'IMPLEMENTED') {
        action = 'IMPLEMENT';
    } else if (status === 'CANCELLED') {
        action = 'CANCEL';
    }

    try {
        return await ProjectChangeOrderService.updateChangeOrder(coId, action, {
            approvedById,
            rejectionReason
        });
    } catch (error: unknown) {
        const err = error as { message?: string };
        const message = err?.message;

        if (message === 'CHANGE_ORDER_NOT_FOUND') {
            throw AppError.notFound('Change order not found');
        }
        if (
            message === 'INVALID_STATUS_DRAFT_ONLY' ||
            message === 'INVALID_STATUS_PENDING_ONLY' ||
            message === 'INVALID_STATUS_APPROVED_ONLY' ||
            message === 'CANNOT_CANCEL_COMPLETED' ||
            message === 'CAN_ONLY_UPDATE_DRAFT_PENDING' ||
            message === 'INVALID_ACTION'
        ) {
            throw AppError.badRequest(message);
        }
        throw error;
    }
}, {
    audit: { action: 'UPDATE', entity: 'CHANGE_ORDER' },
    rawResponse: true
});