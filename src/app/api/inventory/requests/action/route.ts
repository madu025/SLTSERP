import { ROLE_GROUPS } from '@/config/roles';
import { InventoryService } from '@/services/inventory.service';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';

export const POST = apiHandler(async (request, _params, body) => {
    const userId = request.headers.get('x-user-id') || 'SYSTEM';
    const requestId = body.requestId as string | undefined;
    const action = body.action as string | undefined;
    const remarks = body.remarks as string | undefined;
    const allocation = body.allocation as { id: string; approvedQty?: number; issuedQty?: number; receivedQty?: number }[] | undefined;

    if (!requestId || !action) {
        throw AppError.badRequest('Missing required fields');
    }

    const result = await InventoryService.processStockRequestAction({
        requestId,
        action: action as any,
        userId,
        remarks,
        items: allocation
    });

    return result;
}, {
    roles: ROLE_GROUPS.PROJECT_MANAGERS,
    audit: { action: 'UPDATE', entity: 'STOCK_REQUEST' },
    rawResponse: true
});
