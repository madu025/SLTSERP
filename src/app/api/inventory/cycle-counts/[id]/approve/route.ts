import { apiHandler } from '@/lib/api-handler';
import { InventoryService } from '@/services/inventory';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';

export const dynamic = 'force-dynamic';

export const POST = apiHandler(async (_request: Request, params) => {
    const { id } = params;
    const userId = params._userId;
    if (!userId) throw AppError.unauthorized('Authentication required');

    return await InventoryService.approveCycleCount(id, userId);
}, {
    permissions: [RBAC_PERMISSIONS.INVENTORY_APPROVE],
    audit: { action: 'APPROVE', entity: 'CycleCount' },
    rawResponse: true
});
