import { InventoryService } from '@/services/inventory';
import { ROLE_GROUPS } from '@/config/roles';
import { apiHandler } from '@/lib/api-handler';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (request) => {
    const { searchParams } = new URL(request.url);
    const contractorId = searchParams.get('contractorId') || undefined;
    const itemId = searchParams.get('itemId') || undefined;

    const data = await InventoryService.getInHandStock({ contractorId, itemId });
    return data;
}, {
    roles: [...ROLE_GROUPS.STORES, ...ROLE_GROUPS.OPS, ...ROLE_GROUPS.ADMINS],
    rawResponse: true
});
