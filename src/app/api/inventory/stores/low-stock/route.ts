import { InventoryService } from '@/services/inventory.service';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (request) => {
    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get('storeId');
    const itemId = searchParams.get('itemId');

    if (!storeId) {
        throw AppError.badRequest('Store ID is required');
    }

    if (itemId) {
        await InventoryService.checkLowStock(storeId, itemId);
        return { success: true, message: 'Checked low stock for item.' };
    } else {
        const count = await InventoryService.checkAllLowStock(storeId);
        return { success: true, message: `Triggered low stock checks for ${count} items.` };
    }
}, {
    rawResponse: true
});
