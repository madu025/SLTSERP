import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { apiHandler, castBody } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { InventoryService } from '@/services/inventory/inventory.service';

export const dynamic = 'force-dynamic';

// GET: Fetch all active stores (using rawResponse for backwards-compatibility with frontend)
export const GET = apiHandler(async (_req, params) => {
    const userId = params._userId;
    const userRole = params._userRole;

    if (!userId || !userRole) throw AppError.unauthorized('Unauthorized');
    return await InventoryService.getAccessibleStores(userId, userRole);
}, {
    permissions: [RBAC_PERMISSIONS.INVENTORY_READ],
    rawResponse: true
});

// POST: Create a new store (restricted to Stores/System Admins)
export const POST = apiHandler(async (_req, _params, body) => {
    return await InventoryService.createStore(
        castBody<Parameters<typeof InventoryService.createStore>[0]>(body)
    );
}, {
    permissions: [RBAC_PERMISSIONS.INVENTORY_WRITE],
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
    permissions: [RBAC_PERMISSIONS.INVENTORY_WRITE],
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
    permissions: [RBAC_PERMISSIONS.INVENTORY_WRITE],
    audit: { action: 'DELETE', entity: 'STORE' }
});
