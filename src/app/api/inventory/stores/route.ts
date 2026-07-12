import { apiHandler } from '@/lib/api-handler';
import { InventoryService } from '@/services/inventory.service';

export const dynamic = 'force-dynamic';

// GET: Fetch all active stores (using rawResponse for backwards-compatibility with frontend)
export const GET = apiHandler(async () => {
    return await InventoryService.getStores();
}, {
    rawResponse: true
});

// POST: Create a new store (restricted to Stores/System Admins)
export const POST = apiHandler(async (req, _params, body) => {
    return await InventoryService.createStore(body);
}, {
    roles: ['ADMIN', 'SUPER_ADMIN', 'STORES_MANAGER'],
    audit: { action: 'CREATE', entity: 'STORE' }
});

// PUT: Update an existing store
export const PUT = apiHandler(async (req, _params, body) => {
    const { id, ...data } = body;
    if (!id) {
        throw new Error('ID_REQUIRED');
    }
    return await InventoryService.updateStore(id, data);
}, {
    roles: ['ADMIN', 'SUPER_ADMIN', 'STORES_MANAGER'],
    audit: { action: 'UPDATE', entity: 'STORE' }
});

// DELETE: Terminate store record
export const DELETE = apiHandler(async (req) => {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
        throw new Error('ID_REQUIRED');
    }
    return await InventoryService.deleteStore(id);
}, {
    roles: ['ADMIN', 'SUPER_ADMIN', 'STORES_MANAGER'],
    audit: { action: 'DELETE', entity: 'STORE' }
});
