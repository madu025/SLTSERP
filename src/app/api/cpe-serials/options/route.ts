import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { CpeSerialService } from '@/services/inventory/cpe-serial.service';

export const dynamic = 'force-dynamic';

// GET /api/cpe-serials/options: the caller's RTOMs (with their linked store) and the active contractors of those RTOMs
export const GET = apiHandler(async (_req, params) => {
    if (!params._userId) throw AppError.unauthorized('Authentication required');
    return CpeSerialService.options(params._userId);
}, { permissions: [RBAC_PERMISSIONS.INVENTORY_CPE_READ] });
