import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { CpePhoneScanService } from '@/services/inventory/cpe-phone-scan.service';

export const dynamic = 'force-dynamic';

// GET /api/cpe-serials/phone-scan/<token>?after=n: the serials the phone sent (only for the person who started the session)
export const GET = apiHandler(async (req, params) => {
    if (!params._userId) throw AppError.unauthorized('Authentication required');
    const after = Number(new URL(req.url).searchParams.get('after') ?? 0);
    return CpePhoneScanService.poll(params._userId, String(params.token ?? ''), after);
}, { permissions: [RBAC_PERMISSIONS.INVENTORY_CPE_READ, RBAC_PERMISSIONS.INVENTORY_CPE_RECEIVE] });

// DELETE /api/cpe-serials/phone-scan/<token>: the computer closed the window; the phone can add no more
export const DELETE = apiHandler(async (_req, params) => {
    if (!params._userId) throw AppError.unauthorized('Authentication required');
    return CpePhoneScanService.close(params._userId, String(params.token ?? ''));
}, { permissions: [RBAC_PERMISSIONS.INVENTORY_CPE_READ, RBAC_PERMISSIONS.INVENTORY_CPE_RECEIVE] });
