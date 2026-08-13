import { InventoryService } from '@/services/inventory/inventory.service';
import { apiHandler, castBody } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { ROLE_GROUPS } from '@/config/roles';

export const dynamic = 'force-dynamic';

export const POST = apiHandler(async (request, _params, body) => {
    const userId = request.headers.get('x-user-id');
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
    roles: ROLE_GROUPS.STORES_ALL,
    audit: { action: 'CREATE', entity: 'MRN' },
    rawResponse: true
});

export const GET = apiHandler(async (request) => {
    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get('storeId') || undefined;
    const status = searchParams.get('status') || undefined;

    const mrns = await InventoryService.getMRNs(storeId, status);
    return mrns;
}, {
    roles: ROLE_GROUPS.STORES_ALL,
    rawResponse: true
});

export const PATCH = apiHandler(async (request, _params, body) => {
    const mrnId = body.mrnId as string | undefined;
    const action = body.action as string | undefined;
    // Approver identity is session-derived (middleware-set header) —
    // any approvedById supplied in the request body is ignored.
    const approvedById = request.headers.get('x-user-id');
    if (!mrnId || !action) {
        throw AppError.badRequest('mrnId and action are required');
    }
    if (!approvedById) {
        throw AppError.unauthorized('Unauthorized');
    }

    return await InventoryService.updateMRNStatus(mrnId, action as 'APPROVE' | 'REJECT', approvedById);
}, {
    roles: ROLE_GROUPS.STORES_ALL,
    audit: { action: 'UPDATE', entity: 'MRN' },
    rawResponse: true
});
