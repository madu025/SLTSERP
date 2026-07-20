import { InventoryService } from '@/services/inventory.service';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (request) => {
    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get('storeId') || undefined;
    const itemId = searchParams.get('itemId') || undefined;
    const search = searchParams.get('search') || undefined;
    const staffId = searchParams.get('staffId') || undefined;

    if (!storeId && !itemId && !search && !staffId) {
        throw AppError.badRequest('MISSING_PARAMS');
    }

    const serials = await InventoryService.getAllSerials({ storeId, itemId, search, staffId });
    return serials;
}, {
    roles: ['STORES_MANAGER', 'STORES_ASSISTANT', 'ADMIN', 'SUPER_ADMIN', 'OSP_MANAGER', 'AREA_MANAGER'],
    rawResponse: true
});
