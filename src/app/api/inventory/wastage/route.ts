export const dynamic = 'force-dynamic';
import { InventoryService } from '@/services/inventory';
import { apiHandler, castBody } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { StoreService } from '@/services/inventory/store.service';

interface RecordWastageInput {
    storeId?: string;
    contractorId?: string;
    month?: string;
    description?: string;
    reason?: string;
    items: { itemId: string; quantity: string | number; unit?: string }[];
    userId?: string;
}

export const POST = apiHandler(async (_request, params, body) => {
    const userId = params._userId;
    if (!userId) throw AppError.unauthorized('Authentication required');

    const input = castBody<RecordWastageInput>(body);
    if (input.storeId) await StoreService.assertStoreWriteAccess(userId, input.storeId);
    const result = await InventoryService.recordWastage({
        ...input,
        userId
    });

    return result;
}, {
    permissions: [RBAC_PERMISSIONS.INVENTORY_WRITE],
    audit: { action: 'CREATE', entity: 'WASTAGE' },
    rawResponse: true
});
