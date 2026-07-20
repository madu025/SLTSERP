import { InventoryService } from '@/services/inventory';
import { ROLE_GROUPS } from '@/config/roles';
import { apiHandler } from '@/lib/api-handler';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async () => {
    const summary = await InventoryService.getTransitionSummary();
    return summary;
}, {
    roles: [...ROLE_GROUPS.STORES, ...ROLE_GROUPS.ADMINS],
    rawResponse: true
});

export const POST = apiHandler(async (request) => {
    const userId = request.headers.get('x-user-id') || 'SYSTEM';
    const result = await InventoryService.executeBulkSwap(userId);
    return result;
}, {
    roles: [...ROLE_GROUPS.STORES, ...ROLE_GROUPS.ADMINS],
    audit: { action: 'POST_ACTION', entity: 'VIRTUAL_SWAP' },
    rawResponse: true
});
