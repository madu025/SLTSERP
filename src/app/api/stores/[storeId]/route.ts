import { apiHandler } from '@/lib/api-handler';
import { InventoryService } from '@/services/inventory.service';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

// GET - Get single store
export const GET = apiHandler(async (_request, params) => {
    const { storeId } = await params;
    const store = await InventoryService.getStore(storeId);

    if (!store) {
        throw AppError.notFound('Store not found');
    }

    return store;
}, { rawResponse: true });

// PUT - Update store
export const PUT = apiHandler(async (_request, params, body) => {
    const { storeId } = await params;
    const store = await InventoryService.updateStore(storeId, body);
    return store;
}, {
    roles: ['ADMIN', 'SUPER_ADMIN'],
    audit: { action: 'STORE_UPDATE', entity: 'Store' },
    rawResponse: true
});

// DELETE - Delete store
export const DELETE = apiHandler(async (_request, params) => {
    const { storeId } = await params;

    try {
        await InventoryService.deleteStore(storeId);
        return { success: true };
    } catch (error: any) {
        if (error?.message === 'STORE_HAS_STOCK' || error?.message === 'STORE_HAS_TRANSACTIONS') {
            throw AppError.badRequest('Store cannot be deleted as it has associated stock or transactions');
        }
        throw error;
    }
}, {
    roles: ['SUPER_ADMIN'],
    audit: { action: 'STORE_DELETE', entity: 'Store' },
    rawResponse: true
});
