export const dynamic = 'force-dynamic';
import { InventoryService } from '@/services/inventory';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';

export const POST = apiHandler(async (_request, params, body) => {
    const userId = params._userId;
    const id = body.id as string | undefined;
    const action = body.action as string | undefined;

    if (!id) throw AppError.badRequest('Missing ID');
    if (!userId) throw AppError.unauthorized('Authentication required');

    const result = action === 'REJECT'
        ? await InventoryService.rejectWastage(id, userId)
        : await InventoryService.approveWastage(id, userId);
    return result;
}, {
    permissions: [RBAC_PERMISSIONS.INVENTORY_APPROVE],
    audit: { action: 'POST_ACTION', entity: 'WASTAGE' },
    rawResponse: true
});
