import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { CpeSerialService } from '@/services/inventory/cpe-serial.service';
import { parseCpeType } from '@/lib/cpe-serial-rules';

export const dynamic = 'force-dynamic';

// GET /api/cpe-serials/check?serial=&serviceOrderId=&cpeType=ONT&contractorId=&reuse=1 : may this serial be used on this order?
// Shown on Confirm Completion while a serial is typed or scanned; phase 1 never blocks the save.
export const GET = apiHandler(async (req, params) => {
    if (!params._userId) throw AppError.unauthorized('Authentication required');
    const sp = new URL(req.url).searchParams;
    const serial = sp.get('serial') ?? '';
    const serviceOrderId = sp.get('serviceOrderId') ?? '';
    const cpeType = parseCpeType(sp.get('cpeType'));
    if (!serial.trim() || !serviceOrderId || !cpeType) throw AppError.badRequest('serial, serviceOrderId and cpeType are required');
    return CpeSerialService.checkForOrder(params._userId, { serial, serviceOrderId, cpeType, contractorId: sp.get('contractorId') || null, reuse: sp.get('reuse') === '1' });
}, { permissions: [RBAC_PERMISSIONS.SOD_READ] });
