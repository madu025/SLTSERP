import { apiHandler } from '@/lib/api-handler';
import { getAuthenticatedUserId } from '@/lib/request-context';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { SODSltReportedMaterialService } from '@/services/service-order/sod-slt-reported-material.service';

export const dynamic = 'force-dynamic';

/** GET ?serviceOrderId=&contractorId= : contractor in-hand stock + SLT-reported material (with received date) for the entry form. */
export const GET = apiHandler(async (req: Request) => {
    const userId = getAuthenticatedUserId();
    if (!userId) throw AppError.unauthorized('Authenticated user is required');
    const sp = new URL(req.url).searchParams;
    const serviceOrderId = sp.get('serviceOrderId');
    if (!serviceOrderId) throw AppError.badRequest('serviceOrderId is required');
    return SODSltReportedMaterialService.materialContext(userId, serviceOrderId, sp.get('contractorId') || undefined);
}, {
    permissions: [RBAC_PERMISSIONS.SOD_READ],
});
