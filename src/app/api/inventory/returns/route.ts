import { InventoryService } from '@/services/inventory.service';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { materialReturnSchema } from '@/lib/validations';

export const dynamic = 'force-dynamic';

export const POST = apiHandler(async (request, _params, body) => {
    const userEmail = request.headers.get('x-user-id');

    try {
        const validatedData = materialReturnSchema.parse(body);
        const result = await InventoryService.createMaterialReturn({
            ...validatedData,
            items: validatedData.items.map(i => ({ ...i, quantity: i.quantity.toString() })),
            userId: userEmail || 'System'
        });

        return { message: 'Return processed successfully', id: result.id };
    } catch (validationErr: any) {
        throw AppError.badRequest(validationErr.errors?.[0]?.message || 'Invalid data');
    }
}, {
    roles: ['STORES_MANAGER', 'STORES_ASSISTANT', 'SUPER_ADMIN', 'ADMIN'],
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
