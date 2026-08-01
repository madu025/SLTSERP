import { ServiceOrderService } from '@/services/sod/sod.service';
import { serviceOrderCreateSchema, serviceOrderPatchSchema, serviceOrderUpdateSchema } from '@/lib/validations/service-order.schema';
import { apiHandler } from '@/lib/api-handler';
import { AppError, ErrorCode } from '@/lib/error';

export const dynamic = 'force-dynamic';

// GET service orders with pagination and summary metrics
export const GET = apiHandler(async (request) => {
    const { searchParams } = new URL(request.url);
    const params = {
        rtomId: searchParams.get('rtomId') || searchParams.get('opmcId') || searchParams.get('rtom') || '',
        filter: searchParams.get('filter') || 'pending',
        search: searchParams.get('search') || undefined,
        statusFilter: searchParams.get('statusFilter') || undefined,
        patFilter: searchParams.get('patFilter') || undefined,
        matFilter: searchParams.get('matFilter') || undefined,
        page: parseInt(searchParams.get('page') || '1'),
        limit: parseInt(searchParams.get('limit') || '50'),
        cursor: searchParams.get('cursor') || undefined,
        month: searchParams.get('month') && searchParams.get('month') !== 'ALL' && !isNaN(parseInt(searchParams.get('month')!)) ? parseInt(searchParams.get('month')!) : undefined,
        year: searchParams.get('year') && searchParams.get('year') !== 'ALL' && !isNaN(parseInt(searchParams.get('year')!)) ? parseInt(searchParams.get('year')!) : undefined,
    };

    // rtomId is optional (allows fetching cross-OPMC completed/invoicable SODs)

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
        const serviceOrder = await ServiceOrderService.patchServiceOrder(id, updateData, userId);
        return serviceOrder;
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
        const serviceOrder = await ServiceOrderService.patchServiceOrder(id, updateData, userId);
        return serviceOrder;
    },
    { schema: serviceOrderPatchSchema, rawResponse: true }
);
