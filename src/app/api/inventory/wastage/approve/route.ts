import { InventoryService } from '@/services/inventory';
import { ROLE_GROUPS } from '@/config/roles';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';

export const POST = apiHandler(async (request, _params, body) => {
    const userId = request.headers.get('x-user-id') || '';
    const { id, action } = body;
    
    if (!id) throw AppError.badRequest('Missing ID');

    let result;
    if (action === 'REJECT') {
        result = await InventoryService.rejectWastage(id, userId);
    } else {
        result = await InventoryService.approveWastage(id, userId);
    }
    return result;
}, {
    roles: [...ROLE_GROUPS.ADMINS, 'OSP_MANAGER'],
    audit: { action: 'POST_ACTION', entity: 'WASTAGE' },
    rawResponse: true
});
