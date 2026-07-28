import { ROLE_GROUPS } from '@/config/roles';
import { InventoryService } from '@/services/inventory.service';
import { apiHandler } from '@/lib/api-handler';
import { materialReturnSchema } from '@/lib/validations/inventory.schema';

export const dynamic = 'force-dynamic';

export const POST = apiHandler(async (request, _params, body) => {
    const userEmail = request.headers.get('x-user-id');

    const result = await InventoryService.createMaterialReturn({
        ...body,
        items: body.items.map((i: { itemId: string; quantity: string | number; unit?: string; condition?: string; serials?: string[] }) => ({ ...i, quantity: i.quantity.toString() })),
        userId: userEmail || 'System'
    });

    return { message: 'Return processed successfully', id: result.id };
}, {
    schema: materialReturnSchema,
    roles: ROLE_GROUPS.STORES_ALL,
    audit: { action: 'CREATE', entity: 'MATERIAL_RETURN' },
    rawResponse: true
});

export const GET = apiHandler(async (request) => {
    const { searchParams } = new URL(request.url);
    const filters = {
        contractorId: searchParams.get('contractorId') || undefined,
        storeId: searchParams.get('storeId') || undefined,
        month: searchParams.get('month') || undefined
    };

    const returns = await InventoryService.getMaterialReturns(filters);
    return returns;
}, { rawResponse: true });
