import { ServiceOrderService } from '@/services/sod.service';
import { serviceOrderCreateSchema, serviceOrderPatchSchema, serviceOrderUpdateSchema } from '@/lib/validations/service-order.schema';
import { apiHandler } from '@/lib/api-handler';
import { AppError, ErrorCode } from '@/lib/error';

export const dynamic = 'force-dynamic';

// GET service orders with pagination and summary metrics
export const GET = apiHandler(async (request) => {
    const { searchParams } = new URL(request.url);
    const params = {
        rtomId: searchParams.get('rtomId') || searchParams.get('opmcId') || '',
        filter: searchParams.get('filter') || 'pending',
        search: searchParams.get('search') || undefined,
        statusFilter: searchParams.get('statusFilter') || undefined,
        patFilter: searchParams.get('patFilter') || undefined,
        matFilter: searchParams.get('matFilter') || undefined,
        page: parseInt(searchParams.get('page') || '1'),
        limit: parseInt(searchParams.get('limit') || '50'),
        cursor: searchParams.get('cursor') || undefined,
        month: searchParams.get('month') ? parseInt(searchParams.get('month')!) : undefined,
        year: searchParams.get('year') ? parseInt(searchParams.get('year')!) : undefined,
    };

    if (!params.rtomId) {
        throw AppError.badRequest('RTOM selection is required');
    }

    const userId = request.headers.get('x-user-id') || 'SYSTEM';
    const result = await ServiceOrderService.getServiceOrders(userId, params);
    return result;
}, { rawResponse: true });

// POST - Create manual service order
export const POST = apiHandler(
    async () => {
        throw new AppError('Manual creation not implemented', ErrorCode.INTERNAL_ERROR, 501);
    },
    { schema: serviceOrderCreateSchema }
);

// PUT - Update service order
export const PUT = apiHandler(
    async (request, params, body) => {
        const { id, ...updateData } = body;
        if (!id) {
            throw AppError.badRequest('Service Order ID required');
        }
        
        const userId = request.headers.get('x-user-id') || undefined;
        try {
            const serviceOrder = await ServiceOrderService.patchServiceOrder(id, updateData, userId);
            return serviceOrder;
        } catch (error: unknown) {
            const err = error as Error;
            if (err?.message === 'ID_REQUIRED') throw AppError.badRequest('Service Order ID required');
            throw error;
        }
    },
    { schema: serviceOrderUpdateSchema, rawResponse: true }
);

// PATCH - Update SLTS Status query or Contractor assignment
export const PATCH = apiHandler(
    async (request, params, body) => {
        const { id, ...updateData } = body;
        if (!id) {
            throw AppError.badRequest('Service Order ID required');
        }

        const userId = request.headers.get('x-user-id') || undefined;
        try {
            const serviceOrder = await ServiceOrderService.patchServiceOrder(id, updateData, userId);
            return serviceOrder;
        } catch (error: unknown) {
            const err = error as Error;
            if (err?.message === 'ID_REQUIRED') throw AppError.badRequest('Service Order ID required');
            if (err?.message === 'INVALID_STATUS') throw AppError.badRequest('Invalid SLTS Status');
            if (err?.message === 'COMPLETED_DATE_REQUIRED') throw AppError.badRequest('Completed date is required for COMPLETED or RETURN status');
            throw error;
        }
    },
    { schema: serviceOrderPatchSchema, rawResponse: true }
);
