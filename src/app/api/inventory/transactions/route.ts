import { InventoryService } from '@/services/inventory/inventory.service';
import { apiHandler } from '@/lib/api-handler';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { StoreService } from '@/services/inventory/store.service';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (request, params) => {
    const { searchParams } = new URL(request.url);

    const filters = {
        itemId: searchParams.get('itemId') || undefined,
        storeId: searchParams.get('storeId') || undefined,
        type: searchParams.get('type') || undefined,
        startDate: searchParams.get('startDate') || undefined,
        endDate: searchParams.get('endDate') || undefined,
    };

    if (!params._userId) throw AppError.unauthorized('Authentication required');
    const allowed = (await StoreService.getAccessibleStores(params._userId)).map((st) => st.id);
    if (filters.storeId && !allowed.includes(filters.storeId)) throw AppError.forbidden('STORE_SCOPE_VIOLATION');
    const transactions = await InventoryService.getTransactions({ ...filters, storeIds: filters.storeId ? undefined : allowed });
    return transactions;
}, {
    permissions: [RBAC_PERMISSIONS.INVENTORY_READ],
    rawResponse: true
});
