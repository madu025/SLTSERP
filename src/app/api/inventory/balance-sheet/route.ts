export const dynamic = 'force-dynamic';
import { ROLE_GROUPS } from '@/config/roles';
import { InventoryService } from '@/services/inventory/inventory.service';
import { apiHandler } from '@/lib/api-handler';

export const POST = apiHandler(async (request, _params, body) => {
    const userId = request.headers.get('x-user-id');

    const result = await InventoryService.saveBalanceSheet({
        ...body,
        userId: userId || 'SYSTEM'
    } as Parameters<typeof InventoryService.saveBalanceSheet>[0]);
    return { message: 'Balance sheet saved successfully', id: result.id };
}, {
    roles: ROLE_GROUPS.STORES_ALL,
    audit: { action: 'CREATE', entity: 'BALANCE_SHEET' },
    rawResponse: true
});
