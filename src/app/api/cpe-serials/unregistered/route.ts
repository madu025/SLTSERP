import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { CpeSerialService } from '@/services/inventory/cpe-serial.service';

export const dynamic = 'force-dynamic';

// GET /api/cpe-serials/unregistered?opmcId= : completed orders whose ONT is not an installed SLT serial of the register (what WARN lets through)
export const GET = apiHandler(async (req, params) => {
    if (!params._userId) throw AppError.unauthorized('Authentication required');
    return CpeSerialService.unregisteredOrders(params._userId, new URL(req.url).searchParams.get('opmcId')?.trim() || undefined);
}, { permissions: [RBAC_PERMISSIONS.INVENTORY_CPE_READ] });
