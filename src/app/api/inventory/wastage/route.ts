export const dynamic = 'force-dynamic';
import { InventoryService } from '@/services/inventory';
import { ROLE_GROUPS } from '@/config/roles';
import { apiHandler, castBody } from '@/lib/api-handler';

interface RecordWastageInput {
    storeId?: string;
    contractorId?: string;
    month?: string;
    description?: string;
    reason?: string;
    items: { itemId: string; quantity: string | number; unit?: string }[];
    userId?: string;
}

export const POST = apiHandler(async (request, _params, body) => {
    const userId = request.headers.get('x-user-id') || undefined;

    const input = castBody<RecordWastageInput>(body);
    const result = await InventoryService.recordWastage({
        ...input,
        userId
    });

    return result;
}, {
    roles: ROLE_GROUPS.STORES_MANAGERS,
    audit: { action: 'CREATE', entity: 'WASTAGE' },
    rawResponse: true
});
