import { apiHandler } from '@/lib/api-handler';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { AreaContractorStockService } from '@/services/service-order/area-contractor-stock.service';

export const dynamic = 'force-dynamic';

// GET /api/service-orders/contractor-stock - the material the contractors of the caller's own RTOMs hold in hand (read-only, own area only)
export const GET = apiHandler(async (req, params) => {
    const sp = new URL(req.url).searchParams;
    return AreaContractorStockService.forUser(params._userId ?? '', { rtom: sp.get('rtom') ?? undefined });
}, { permissions: [RBAC_PERMISSIONS.SOD_READ] });
