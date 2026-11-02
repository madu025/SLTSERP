export const dynamic = 'force-dynamic';
import { InventoryService } from '@/services/inventory/inventory.service';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';

export const POST = apiHandler(async (_request, params, body) => {
    const userId = params._userId;
    if (!userId) throw AppError.unauthorized('Authentication required');

    const result = await InventoryService.saveBalanceSheet({
        ...body,
        userId
    } as Parameters<typeof InventoryService.saveBalanceSheet>[0]);
    return { message: 'Balance sheet saved successfully', id: result.id };
}, {
    permissions: [RBAC_PERMISSIONS.INVENTORY_WRITE],
    audit: { action: 'CREATE', entity: 'BALANCE_SHEET' },
    rawResponse: true
});
