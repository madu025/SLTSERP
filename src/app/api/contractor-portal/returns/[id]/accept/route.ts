import { ROLE_GROUPS } from '@/config/roles';
import { apiHandler } from '@/lib/api-handler';


import { ContractorInventoryService } from '@/services/inventory/contractor-inventory.service';

export const dynamic = 'force-dynamic';

// POST /api/contractor-portal/returns/[id]/accept - Storekeeper fine-tunes & accepts MRN return request
export const POST = apiHandler(async (req, params, body) => {
    const { acceptedQuantity, acceptedQuantities, storekeeperNotes } = body;
    const userId = req.headers.get('x-user-id');

    return await ContractorInventoryService.acceptMaterialReturn(
        params.id, 
        acceptedQuantity !== undefined ? Number(acceptedQuantity) : undefined, 
        storekeeperNotes as string | undefined, 
        userId, 
        acceptedQuantities as any
    );
}, {
    roles: ROLE_GROUPS.STORES_MANAGERS,
});
