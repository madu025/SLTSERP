import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { CollectedCpeService } from '@/services/inventory/collected-cpe.service';

export const dynamic = 'force-dynamic';

// GET /api/cpe-serials/collected?opmcId=&contractorId=&month=YYYY-MM&status= : old devices collected from customers, for the Collected CPE Handing Over Form
export const GET = apiHandler(async (req, params) => {
    if (!params._userId) throw AppError.unauthorized('Authentication required');
    const sp = new URL(req.url).searchParams;
    const get = (k: string) => sp.get(k)?.trim() || undefined;
    return CollectedCpeService.list(params._userId, { opmcId: get('opmcId'), contractorId: get('contractorId'), month: get('month'), status: get('status') });
}, { permissions: [RBAC_PERMISSIONS.INVENTORY_CPE_READ] });
