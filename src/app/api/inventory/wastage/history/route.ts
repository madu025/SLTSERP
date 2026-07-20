import { InventoryService } from '@/services/inventory';
import { ROLE_GROUPS } from '@/config/roles';
import { apiHandler } from '@/lib/api-handler';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (request) => {
    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get('storeId') || undefined;
    const contractorId = searchParams.get('contractorId') || undefined;
    const month = searchParams.get('month') || undefined;

    const data = await InventoryService.getWastageHistory({ storeId, contractorId, month });
    return data;
}, {
    roles: [...ROLE_GROUPS.STORES, ...ROLE_GROUPS.OPS, ...ROLE_GROUPS.ADMINS],
    rawResponse: true
});
