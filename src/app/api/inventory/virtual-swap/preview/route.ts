import { InventoryService } from '@/services/inventory';
import { ROLE_GROUPS } from '@/config/roles';
import { apiHandler } from '@/lib/api-handler';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async () => {
    const data = await InventoryService.getTransitionPreview();
    return data;
}, {
    roles: [...ROLE_GROUPS.STORES, ...ROLE_GROUPS.ADMINS],
    rawResponse: true
});
