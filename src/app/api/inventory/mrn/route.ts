import { InventoryService } from '@/services/inventory/inventory.service';
import { apiHandler, castBody } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { StoreService } from '@/services/inventory/store.service';

export const dynamic = 'force-dynamic';

export const POST = apiHandler(async (_request, params, body) => {
    const userId = params._userId;
    if (!userId) {
        throw AppError.unauthorized('Unauthorized');
    }

    const result = await InventoryService.createMRN({
        ...castBody<Omit<Parameters<typeof InventoryService.createMRN>[0], 'returnedById'>>(body),
        // Creator identity is session-derived — never trust the request body
        returnedById: userId
    });
    return result;
}, {
    permissions: [RBAC_PERMISSIONS.INVENTORY_WRITE],
    audit: { action: 'CREATE', entity: 'MRN' },
    rawResponse: true
});

export const GET = apiHandler(async (request, params) => {
    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get('storeId') || undefined;
    const status = searchParams.get('status') || undefined;

    if (!params._userId) throw AppError.unauthorized('Authentication required');
    const allowedStoreIds = (await StoreService.getAccessibleStores(params._userId)).map((store) => store.id);
    if (storeId && !allowedStoreIds.includes(storeId)) {
        throw AppError.forbidden('STORE_SCOPE_VIOLATION');
    }
    const mrns = await InventoryService.getMRNs(storeId, status, allowedStoreIds);
    return mrns;
}, {
    permissions: [RBAC_PERMISSIONS.INVENTORY_READ],
    rawResponse: true
});

export const PATCH = apiHandler(async (_request, params, body) => {
    const mrnId = body.mrnId as string | undefined;
    const action = body.action as string | undefined;
    // Approver identity is session-derived (middleware-set header) —
    // any approvedById supplied in the request body is ignored.
    const approvedById = params._userId;
    if (!mrnId || !action) {
        throw AppError.badRequest('mrnId and action are required');
    }
    if (!approvedById) {
        throw AppError.unauthorized('Unauthorized');
    }

    return await InventoryService.updateMRNStatus(mrnId, action as 'APPROVE' | 'REJECT', approvedById);
}, {
    permissions: [RBAC_PERMISSIONS.INVENTORY_APPROVE],
    audit: { action: 'UPDATE', entity: 'MRN' },
    rawResponse: true
});
