import { InventoryService } from '@/services/inventory/inventory.service';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { StoreService } from '@/services/inventory/store.service';
import { materialReturnSchema } from '@/lib/validations/inventory.schema';

export const dynamic = 'force-dynamic';

export const POST = apiHandler(async (_request, params, body) => {
    const userId = params._userId;
    if (!userId) throw AppError.unauthorized('Authentication required');

    const result = await InventoryService.createMaterialReturn({
        ...body,
        items: body.items.map((i: { itemId: string; quantity: string | number; unit?: string; condition?: string; serials?: string[] }) => ({ ...i, quantity: i.quantity.toString() })),
        userId
    });

    return { message: 'Return processed successfully', id: result.id, returnNumber: result.returnNumber };
}, {
    schema: materialReturnSchema,
    permissions: [RBAC_PERMISSIONS.INVENTORY_WRITE],
    audit: { action: 'CREATE', entity: 'MATERIAL_RETURN' },
    rawResponse: true
});

export const GET = apiHandler(async (request, params) => {
    const { searchParams } = new URL(request.url);
    const filters = {
        contractorId: searchParams.get('contractorId') || undefined,
        storeId: searchParams.get('storeId') || undefined,
        month: searchParams.get('month') || undefined
    };
    if (!params._userId) throw AppError.unauthorized('Authentication required');
    const allowedStoreIds = (await StoreService.getAccessibleStores(params._userId, params._userRole || '')).map((store) => store.id);
    if (filters.storeId && !allowedStoreIds.includes(filters.storeId)) {
        throw AppError.forbidden('STORE_SCOPE_VIOLATION');
    }

    const returns = await InventoryService.getMaterialReturns(filters, allowedStoreIds);
    return returns;
}, { permissions: [RBAC_PERMISSIONS.INVENTORY_READ], rawResponse: true });
