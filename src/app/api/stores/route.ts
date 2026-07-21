import { apiHandler } from '@/lib/api-handler';
import { InventoryService } from '@/services/inventory.service';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

// GET - Get all stores with their OPMCs (Filtered by User Role)
export const GET = apiHandler(async (request) => {
    const userId = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role');

    if (!userId || !userRole) {
        throw AppError.unauthorized('Unauthorized');
    }

    try {
        const stores = await InventoryService.getAccessibleStores(userId, userRole);
        return stores;
    } catch (error: any) {
        if (error?.message === 'USER_NOT_FOUND') {
            throw AppError.notFound('User not found');
        }
        throw error;
    }
}, { rawResponse: true });

// POST - Create new store
export const POST = apiHandler(async (_request, _params, body) => {
    if (!body?.name) {
        throw AppError.badRequest('Store name is required');
    }

    const store = await InventoryService.createStore(body);
    return store;
}, {
    roles: ['ADMIN', 'SUPER_ADMIN'],
    audit: { action: 'STORE_CREATE', entity: 'Store' },
    rawResponse: true
});
