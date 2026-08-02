import { ROLE_GROUPS } from '@/config/roles';
import { InventoryService } from '@/services/inventory/inventory.service';
import { apiHandler } from '@/lib/api-handler';


export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (request) => {
    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get('storeId') || undefined;
    const itemId = searchParams.get('itemId') || undefined;
    const search = searchParams.get('search') || undefined;
    const staffId = searchParams.get('staffId') || undefined;

    // We allow empty params to return the latest 100 serials (handled by take: 100 in service)
    const serials = await InventoryService.getAllSerials({ storeId, itemId, search, staffId });
    return serials;
}, {
    roles: ROLE_GROUPS.PROJECT_MANAGERS,
    rawResponse: true
});
