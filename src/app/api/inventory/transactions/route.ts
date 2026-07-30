import { ROLE_GROUPS } from '@/config/roles';
import { InventoryService } from '@/services/inventory/inventory.service';
import { apiHandler } from '@/lib/api-handler';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (request) => {
    const { searchParams } = new URL(request.url);

    const filters = {
        itemId: searchParams.get('itemId') || undefined,
        storeId: searchParams.get('storeId') || undefined,
        type: searchParams.get('type') || undefined,
        startDate: searchParams.get('startDate') || undefined,
        endDate: searchParams.get('endDate') || undefined,
    };

    const transactions = await InventoryService.getTransactions(filters);
    return transactions;
}, {
    roles: ROLE_GROUPS.PROJECT_MANAGERS,
    rawResponse: true
});
