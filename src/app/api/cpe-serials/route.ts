import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { CpeSerialService } from '@/services/inventory/cpe-serial.service';

export const dynamic = 'force-dynamic';

// GET /api/cpe-serials?opmcId=&status=&cpeType=&contractorId=&q=&page= : the CPE serial register of the caller's RTOMs
export const GET = apiHandler(async (req, params) => {
    if (!params._userId) throw AppError.unauthorized('Authentication required');
    const sp = new URL(req.url).searchParams;
    const get = (k: string) => sp.get(k)?.trim() || undefined;
    return CpeSerialService.list(params._userId, { opmcId: get('opmcId'), status: get('status'), cpeType: get('cpeType'), contractorId: get('contractorId'), q: get('q'), page: Number(get('page') ?? 1) || 1 });
}, { permissions: [RBAC_PERMISSIONS.INVENTORY_CPE_READ] });
