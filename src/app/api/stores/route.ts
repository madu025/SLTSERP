import { ROLE_GROUPS } from '@/config/roles';
import { apiHandler } from '@/lib/api-handler';
import { InventoryService } from '@/services/inventory/inventory.service';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

// GET - Get all stores with their OPMCs (Filtered by User Role)
export const GET = apiHandler(async (request) => {
    const userId = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role');

    if (!userId || !userRole) {
        throw AppError.unauthorized('Unauthorized');
    }

    return await InventoryService.getAccessibleStores(userId, userRole);
}, { rawResponse: true });

// POST - Create new store
export const POST = apiHandler(async (_request, _params, body) => {
    if (!body?.name) {
        throw AppError.badRequest('Store name is required');
    }

    const store = await InventoryService.createStore(body as { name: string; type: string; location?: string; managerId?: string; opmcIds?: string[]; });
    return store;
}, {
    roles: ROLE_GROUPS.ADMINS,
    audit: { action: 'STORE_CREATE', entity: 'Store' },
    rawResponse: true
});
