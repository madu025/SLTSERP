import { apiHandler } from '@/lib/api-handler';
import { ProjectChangeOrderService } from '@/services/project/project-change-order.service';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (request) => {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
        throw AppError.badRequest('projectId is required');
    }

    return await ProjectChangeOrderService.getChangeOrders(projectId);
}, { rawResponse: true });

export const POST = apiHandler(async (_request, _params, body) => {
    const { projectId, title } = body || {};

    if (!projectId || !title) {
        throw AppError.badRequest('projectId and title are required');
    }

    try {
        const changeOrder = await ProjectChangeOrderService.createChangeOrder(body);
        return Response.json(changeOrder, { status: 201 });
    } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : '';
        if (errorMsg === 'PROJECT_NOT_FOUND') {
            throw AppError.notFound('Project not found');
        }
        throw error;
    }
}, {
    audit: { action: 'CREATE', entity: 'CHANGE_ORDER' },
    rawResponse: true
});

export const PATCH = apiHandler(async (_request, _params, body) => {
    const { id, action, ...updateData } = body || {};

    if (!id) {
        throw AppError.badRequest('id is required');
    }

    try {
        return await ProjectChangeOrderService.updateChangeOrder(id, action, updateData);
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
    audit: { action: 'UPDATE', entity: 'CHANGE_ORDER' },
    rawResponse: true
});

export const DELETE = apiHandler(async (request) => {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
        throw AppError.badRequest('id is required');
    }

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
    audit: { action: 'DELETE', entity: 'CHANGE_ORDER' },
    rawResponse: true
});
