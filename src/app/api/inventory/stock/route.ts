import { apiHandler } from '@/lib/api-handler';
import { InventoryService } from '@/services/inventory.service';

export const dynamic = 'force-dynamic';

// GET: Fetch stock levels for a store
export const GET = apiHandler(async (req) => {
    const { searchParams } = new URL(req.url);
    const storeId = searchParams.get('storeId');

    if (!storeId) {
        throw new Error('STORE_ID_REQUIRED');
    }

    return await InventoryService.getStock(storeId);
}, {
    rawResponse: true
});

// POST: Bulk Update / Initialize Stock
export const POST = apiHandler(async (req, _params, body) => {
    const { storeId, items, reason } = body;
    const userId = req.headers.get('x-user-id') || 'SYSTEM';

    if (!storeId || !items) {
        throw new Error('INVALID_PAYLOAD');
    }

    const result = await InventoryService.initializeStock(storeId, items, reason, userId);
    return { message: 'Stock updated successfully', itemsUpdated: result };
}, {
    roles: ['ADMIN', 'SUPER_ADMIN', 'STORES_MANAGER'],
    audit: { action: 'STOCK_INITIALIZE', entity: 'STOCK' },
    rawResponse: true
});
