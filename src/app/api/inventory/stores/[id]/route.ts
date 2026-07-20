import { InventoryService } from '@/services/inventory.service';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (request, params) => {
    const resolvedParams = await params;
    const { id } = resolvedParams;
    if (!id) {
        throw AppError.badRequest('Store ID is required');
    }

    const store = await InventoryService.getStore(id);
    if (!store) {
        throw AppError.notFound('Store not found');
    }

    return store;
}, {
    rawResponse: true
});
