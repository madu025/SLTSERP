import { InventoryService } from '@/services/inventory.service';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';

export const POST = apiHandler(async (request, _params, body) => {
    const userId = request.headers.get('x-user-id') || 'SYSTEM';
    const { requestId, action, remarks, allocation } = body;

    if (!requestId || !action) {
        throw AppError.badRequest('Missing required fields');
    }

    const result = await InventoryService.processStockRequestAction({
        requestId,
        action,
        userId,
        remarks,
        items: allocation
    });

    return result;
}, {
    roles: ['STORES_MANAGER', 'OSP_MANAGER', 'ADMIN', 'SUPER_ADMIN', 'STORES_ASSISTANT', 'AREA_MANAGER'],
    audit: { action: 'UPDATE', entity: 'STOCK_REQUEST' },
    rawResponse: true
});
