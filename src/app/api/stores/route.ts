import { apiHandler } from '@/lib/api-handler';
import { InventoryService } from '@/services/inventory/inventory.service';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';

export const dynamic = 'force-dynamic';

// GET - Get all stores with their OPMCs (Filtered by User Role)
export const GET = apiHandler(async (_request, params) => {
    const userId = params._userId;
    const userRole = params._userRole;

    if (!userId || !userRole) {
        throw AppError.unauthorized('Unauthorized');
    }

    return await InventoryService.getAccessibleStores(userId, userRole);
}, {
    permissions: [RBAC_PERMISSIONS.INVENTORY_READ],
    rawResponse: true,
});

// POST - Create new store
export const POST = apiHandler(async (_request, _params, body) => {
    if (!body?.name) {
        throw AppError.badRequest('Store name is required');
    }

    const store = await InventoryService.createStore(body as { name: string; type: string; location?: string; managerId?: string; opmcIds?: string[]; });
    return store;
}, {
    permissions: [RBAC_PERMISSIONS.INVENTORY_WRITE],
    audit: { action: 'STORE_CREATE', entity: 'Store' },
    rawResponse: true
});
