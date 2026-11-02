import { InventoryService } from '@/services/inventory';
import { apiHandler } from '@/lib/api-handler';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (request) => {
    const { searchParams } = new URL(request.url);
    const contractorId = searchParams.get('contractorId') || undefined;
    const itemId = searchParams.get('itemId') || undefined;

    const data = await InventoryService.getInHandStock({ contractorId, itemId });
    return data;
}, {
    permissions: [RBAC_PERMISSIONS.INVENTORY_READ],
    rawResponse: true
});
