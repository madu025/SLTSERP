import { apiHandler } from '@/lib/api-handler';


import { ContractorInventoryService } from '@/services/inventory/contractor-inventory.service';

export const dynamic = 'force-dynamic';

// POST /api/contractor-portal/returns/[id]/accept - Storekeeper fine-tunes & accepts MRN return request
export const POST = apiHandler(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const body = await req.json();
    const { acceptedQuantity, acceptedQuantities, storekeeperNotes } = body;
    const userId = req.headers.get('x-user-id');

    return await ContractorInventoryService.acceptMaterialReturn(id, acceptedQuantity, storekeeperNotes, userId, acceptedQuantities);
}, {
    roles: ['SUPER_ADMIN', 'ADMIN', 'STORES_MANAGER', 'CONTRACTOR_SUPERVISOR'],
});
