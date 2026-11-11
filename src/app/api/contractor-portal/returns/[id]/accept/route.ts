import { getAuthenticatedUserId } from '@/lib/request-context';
import { apiHandler } from '@/lib/api-handler';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';


import { ContractorInventoryService } from '@/services/inventory/contractor-inventory.service';

export const dynamic = 'force-dynamic';

// POST /api/contractor-portal/returns/[id]/accept - Storekeeper fine-tunes & accepts MRN return request
export const POST = apiHandler(async (req, params, body) => {
    const { acceptedQuantity, acceptedQuantities, storekeeperNotes } = body;
    const userId = getAuthenticatedUserId();

    return await ContractorInventoryService.acceptMaterialReturn(
        params.id, 
        acceptedQuantity !== undefined ? Number(acceptedQuantity) : undefined, 
        storekeeperNotes as string | undefined, 
        userId, 
        acceptedQuantities as any
    );
}, {
    permissions: [RBAC_PERMISSIONS.INVENTORY_APPROVE],
});
