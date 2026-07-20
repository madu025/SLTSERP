import { InventoryService } from '@/services/inventory.service';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (request) => {
    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get('storeId');
    const contractorId = searchParams.get('contractorId');
    const itemId = searchParams.get('itemId') || undefined;

    if (storeId) {
        const batches = await InventoryService.getStoreBatches(storeId, itemId);
        return batches;
    }

    if (contractorId) {
        const batches = await InventoryService.getContractorBatches(contractorId, itemId);
        return batches;
    }

    throw AppError.badRequest('Store ID or Contractor ID is required');
}, {
    roles: ['STORES_MANAGER', 'STORES_ASSISTANT', 'ADMIN', 'SUPER_ADMIN', 'OSP_MANAGER', 'AREA_MANAGER'],
    rawResponse: true
});
