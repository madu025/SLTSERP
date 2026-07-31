export const dynamic = 'force-dynamic';
import { InventoryService } from '@/services/inventory';
import { ROLE_GROUPS } from '@/config/roles';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';

export const POST = apiHandler(async (request, _params, body) => {
    const userId = request.headers.get('x-user-id') || '';
    const id = body.id as string | undefined;
    const action = body.action as string | undefined;

    if (!id) throw AppError.badRequest('Missing ID');

    const result = action === 'REJECT'
        ? await InventoryService.rejectWastage(id, userId)
        : await InventoryService.approveWastage(id, userId);
    return result;
}, {
    roles: ROLE_GROUPS.PROJECT_MANAGERS,
    audit: { action: 'POST_ACTION', entity: 'WASTAGE' },
    rawResponse: true
});
