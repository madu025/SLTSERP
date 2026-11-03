import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { InventoryService } from '@/services/inventory/inventory.service';
import { StoreService } from '@/services/inventory/store.service';
import { grnSchema } from '@/lib/validations/inventory.schema';

// POST: Create a new GRN
export const POST = apiHandler(async (_req, params, body) => {
    const userId = params._userId;
    if (!userId) throw AppError.unauthorized('Authentication required');
    
    return await InventoryService.createGRN({
        ...body,
        receivedById: userId
    });
}, { 
    schema: grnSchema,
    permissions: [RBAC_PERMISSIONS.INVENTORY_WRITE],
    audit: { action: 'CREATE', entity: 'GRN' }
});

// GET: Fetch GRNs
export const GET = apiHandler(async (req, params) => {
    const { searchParams } = new URL(req.url);
    const storeId = searchParams.get('storeId') || undefined;
    if (!params._userId) throw AppError.unauthorized('Authentication required');
    const accessibleStores = await StoreService.getAccessibleStores(params._userId);
    const allowedStoreIds = accessibleStores.map((store) => store.id);
    if (storeId && !allowedStoreIds.includes(storeId)) {
        throw AppError.forbidden('STORE_SCOPE_VIOLATION');
    }

    return await InventoryService.getGRNs(storeId, allowedStoreIds);
}, {
    permissions: [RBAC_PERMISSIONS.INVENTORY_READ],
    rawResponse: true
});

export const dynamic = 'force-dynamic';
