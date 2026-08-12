import { InventoryService } from '@/services/inventory/inventory.service';
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
        // Use DB function fn_low_stock_alerts() for efficient server-side alert computation
        const alerts = await InventoryService.getLowStockAlerts(storeId);
        return { success: true, alerts };
    }
}, {
    rawResponse: true
});
