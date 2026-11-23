import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { ContractorStoreService } from '@/services/inventory/contractor-store.service';

export const dynamic = 'force-dynamic';

/**
 * The contractors a store person may deal with (material issue, returns, wastage, balance in hand): those that work with the person's own stores,
 * or with the one store given. The pages used /api/admin/contractors, which only an administrator may call, so no store person could pick a contractor.
 */
export const GET = apiHandler(async (request, params) => {
    const userId = params._userId;
    if (!userId) throw AppError.unauthorized('Authentication required');
    const storeId = new URL(request.url).searchParams.get('storeId') || undefined;
    const contractors = await ContractorStoreService.listFor(userId, storeId);
    return { contractors };
}, { permissions: [RBAC_PERMISSIONS.INVENTORY_READ], rawResponse: true });
