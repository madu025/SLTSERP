import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { InventoryService } from '@/services/inventory/inventory.service';
import { StoreService } from '@/services/inventory/store.service';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';

export const dynamic = 'force-dynamic';

// GET: Fetch stock levels for a store
export const GET = apiHandler(async (req, params) => {
    const { searchParams } = new URL(req.url);
    const storeId = searchParams.get('storeId');

    if (!storeId) {
        throw AppError.badRequest('STORE_ID_REQUIRED');
    }

    if (!params._userId) throw AppError.unauthorized('Authentication required');
    const accessibleStores = await StoreService.getAccessibleStores(params._userId);
    const allowedStoreIds = accessibleStores.map((store) => store.id);
    if (storeId !== 'all' && !allowedStoreIds.includes(storeId)) {
        throw AppError.forbidden('STORE_SCOPE_VIOLATION');
    }
    return await InventoryService.getStock(storeId, allowedStoreIds);
}, {
    permissions: [RBAC_PERMISSIONS.INVENTORY_READ],
    rawResponse: true
});

// POST: Bulk Update / Initialize Stock
export const POST = apiHandler(async (_req, params, body) => {
    const storeId = body.storeId as string | undefined;
    const items = body.items as unknown[] | undefined;
    const reason = body.reason as string | undefined;
    const userId = params._userId;

    if (!storeId || !items) {
        throw AppError.badRequest('INVALID_PAYLOAD');
    }
    if (!userId) throw AppError.unauthorized('Authentication required');
    const accessibleStores = await StoreService.getAccessibleStores(userId);
    if (!accessibleStores.some((store) => store.id === storeId)) {
        throw AppError.forbidden('STORE_SCOPE_VIOLATION');
    }

    const result = await InventoryService.initializeStock(storeId, items as { itemId: string; quantity: string | number }[], reason, userId);
    return { message: 'Stock updated successfully', itemsUpdated: result };
}, {
    // Overwriting on-hand quantities bypasses the GRN/issue trail, so it is an approver action, not a storekeeper one
    permissions: [RBAC_PERMISSIONS.INVENTORY_APPROVE],
    audit: { action: 'STOCK_INITIALIZE', entity: 'STOCK' },
    rawResponse: true
});
