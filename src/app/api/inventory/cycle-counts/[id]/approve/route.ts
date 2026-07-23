import { apiHandler } from '@/lib/api-handler';
import { InventoryService } from '@/services/inventory';

export const dynamic = 'force-dynamic';

export const POST = apiHandler(async (request: Request, params: any) => {
    const { id } = params;
    const userId = request.headers.get('x-user-id') || 'system';

    return await InventoryService.approveCycleCount(id, userId);
}, {
    roles: ['SUPER_ADMIN', 'ADMIN', 'STORES_MANAGER', 'FINANCE_MANAGER'],
    audit: { action: 'APPROVE', entity: 'CycleCount' },
    rawResponse: true
});
