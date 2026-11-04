import { apiHandler } from '@/lib/api-handler';
import { getAuthenticatedUserId } from '@/lib/request-context';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { SODSltReportedMaterialService } from '@/services/service-order/sod-slt-reported-material.service';

export const dynamic = 'force-dynamic';

const asDate = (v: string | null) => {
    if (!v) return undefined;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? undefined : d;
};

/**
 * GET: SLT-reported material vs manually entered material per service order, plus a per-contractor
 * deviation rate. OPMC scope is applied by the service.
 */
export const GET = apiHandler(async (req: Request) => {
    const userId = getAuthenticatedUserId();
    if (!userId) throw AppError.unauthorized('Authenticated user is required');
    const sp = new URL(req.url).searchParams;
    return SODSltReportedMaterialService.deviationReport(userId, {
        from: asDate(sp.get('from')),
        to: asDate(sp.get('to')),
        opmcId: sp.get('opmcId') || undefined,
        contractorId: sp.get('contractorId') || undefined,
        onlyDeviations: sp.get('all') !== 'true',
        limit: sp.get('limit') ? Number(sp.get('limit')) : undefined,
    });
}, {
    permissions: [RBAC_PERMISSIONS.SOD_INVOICE],
});
