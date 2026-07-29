import { ROLE_GROUPS } from '@/config/roles';
import { apiHandler } from '@/lib/api-handler';
import { InventoryService } from '@/services/inventory';

export const dynamic = 'force-dynamic';

export const POST = apiHandler(async (request: Request, params: any) => {
    const { id } = params;
    const userId = request.headers.get('x-user-id') || 'system';

    return await InventoryService.approveCycleCount(id, userId);
}, {
    roles: ROLE_GROUPS.FINANCE_APPROVERS,
    audit: { action: 'APPROVE', entity: 'CycleCount' },
    rawResponse: true
});
