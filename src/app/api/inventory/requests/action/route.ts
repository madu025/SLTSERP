export const dynamic = 'force-dynamic';
import { InventoryService } from '@/services/inventory/inventory.service';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import type { StockRequestActionData } from '@/types/inventory/inventory-service.types';

export const POST = apiHandler(async (_request, params, body) => {
    const userId = params._userId;
    if (!userId) throw AppError.unauthorized('Authentication required');
    const requestId = body.requestId as string | undefined;
    const action = body.action as string | undefined;
    const remarks = body.remarks as string | undefined;
    const allocation = body.allocation as { id: string; approvedQty?: number; issuedQty?: number; receivedQty?: number }[] | undefined;

    if (!requestId || !action) {
        throw AppError.badRequest('Missing required fields');
    }

    const result = await InventoryService.processStockRequestAction({
        requestId,
        action: action as StockRequestActionData['action'],
        userId,
        remarks,
        items: allocation
    });

    return result;
}, {
    permissions: [RBAC_PERMISSIONS.INVENTORY_WRITE, RBAC_PERMISSIONS.INVENTORY_APPROVE, RBAC_PERMISSIONS.PROCUREMENT_WRITE],
    audit: { action: 'UPDATE', entity: 'STOCK_REQUEST' },
    rawResponse: true
});
