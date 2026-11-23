import { InventoryService } from '@/services/inventory';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { resolveOpmcScope } from '@/lib/opmc-scope';
import { ContractorStoreService } from '@/services/inventory/contractor-store.service';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (request, params) => {
    const { searchParams } = new URL(request.url);
    const contractorId = searchParams.get('contractorId') || undefined;
    const itemId = searchParams.get('itemId') || undefined;

    // the balance in hand of a contractor is read by the stores that contractor works with (or by whoever runs every store)
    if (contractorId) await ContractorStoreService.assertCanSee(params._userId, contractorId);
    else if ((await resolveOpmcScope(params._userId, 'inventory')) !== undefined) throw AppError.badRequest('CONTRACTOR_REQUIRED: choose the contractor.');

    const data = await InventoryService.getInHandStock({ contractorId, itemId });
    return data;
}, {
    permissions: [RBAC_PERMISSIONS.INVENTORY_READ],
    rawResponse: true
});
