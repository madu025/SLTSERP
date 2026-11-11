import { InventoryService } from '@/services/inventory';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async () => {
    const summary = await InventoryService.getTransitionSummary();
    return summary;
}, {
    permissions: [RBAC_PERMISSIONS.INVENTORY_READ],
    rawResponse: true
});

export const POST = apiHandler(async (_request, params) => {
    const userId = params._userId;
    if (!userId) throw AppError.unauthorized('Authentication required');
    const result = await InventoryService.executeBulkSwap(userId);
    return result;
}, {
    // Converts every contractor's SLT batches in one go: approver only
    permissions: [RBAC_PERMISSIONS.INVENTORY_APPROVE],
    audit: { action: 'POST_ACTION', entity: 'VIRTUAL_SWAP' },
    rawResponse: true
});
