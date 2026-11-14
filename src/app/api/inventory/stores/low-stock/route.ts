import { InventoryService } from '@/services/inventory/inventory.service';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { StoreService } from '@/services/inventory/store.service';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (request, params) => {
    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get('storeId');
    const itemId = searchParams.get('itemId');

    if (!storeId) {
        throw AppError.badRequest('Store ID is required');
    }

    // A caller may only look at stores they can access (global users can access all)
    const accessible = await StoreService.getAccessibleStores(params._userId ?? '');
    if (!accessible.some((st) => st.id === storeId)) {
        throw AppError.forbidden('You do not have access to this store');
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
