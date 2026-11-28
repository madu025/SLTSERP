import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { CpeSerialService } from '@/services/inventory/cpe-serial.service';

export const dynamic = 'force-dynamic';

// GET /api/cpe-serials/history?serial= : one serial of the register and every event of its history (a serial may contain "/", so it is a query value)
export const GET = apiHandler(async (req, params) => {
    if (!params._userId) throw AppError.unauthorized('Authentication required');
    const serial = new URL(req.url).searchParams.get('serial') ?? '';
    if (!serial.trim()) throw AppError.badRequest('serial is required');
    return CpeSerialService.history(params._userId, serial);
}, { permissions: [RBAC_PERMISSIONS.INVENTORY_CPE_READ] });
