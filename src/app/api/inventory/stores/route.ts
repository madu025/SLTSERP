import { ROLE_GROUPS } from '@/config/roles';
import { apiHandler, castBody } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { InventoryService } from '@/services/inventory/inventory.service';

export const dynamic = 'force-dynamic';

// GET: Fetch all active stores (using rawResponse for backwards-compatibility with frontend)
export const GET = apiHandler(async (req) => {
    const userId = req.headers.get('x-user-id');
    const userRole = req.headers.get('x-user-role');

    if (userId && userRole) {
        return await InventoryService.getAccessibleStores(userId, userRole);
    }
    
    return await InventoryService.getStores();
}, {
    rawResponse: true
});

// POST: Create a new store (restricted to Stores/System Admins)
export const POST = apiHandler(async (_req, _params, body) => {
    return await InventoryService.createStore(
        castBody<Parameters<typeof InventoryService.createStore>[0]>(body)
    );
}, {
    roles: ROLE_GROUPS.STORES_MANAGERS,
    audit: { action: 'CREATE', entity: 'STORE' }
});

// PUT: Update an existing store
export const PUT = apiHandler(async (_req, _params, body) => {
    const id = body.id as string | undefined;
    if (!id) throw AppError.badRequest('ID_REQUIRED');
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _id, ...data } = body;
    return await InventoryService.updateStore(id, data);
}, {
    roles: ROLE_GROUPS.STORES_MANAGERS,
    audit: { action: 'UPDATE', entity: 'STORE' }
});

// DELETE: Terminate store record
export const DELETE = apiHandler(async (req) => {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
        throw AppError.badRequest('ID_REQUIRED');
    }
    return await InventoryService.deleteStore(id);
}, {
    roles: ROLE_GROUPS.STORES_MANAGERS,
    audit: { action: 'DELETE', entity: 'STORE' }
});
