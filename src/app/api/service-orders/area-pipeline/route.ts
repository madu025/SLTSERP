import { apiHandler } from '@/lib/api-handler';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { AreaPipelineService } from '@/services/service-order/area-pipeline.service';

export const dynamic = 'force-dynamic';

// GET /api/service-orders/area-pipeline - the month-end pipeline of the caller's own RTOMs, with each RTOM's team (read-only, own area only)
export const GET = apiHandler(async (req, params) => {
    const sp = new URL(req.url).searchParams;
    return (await AreaPipelineService.forUser(params._userId ?? '', { month: Number(sp.get('month')) || undefined, year: Number(sp.get('year')) || undefined, rtom: sp.get('rtom') ?? undefined }))
        ?? { month: '', monthNumber: 0, year: 0, rtom: 'ALL', areas: [], people: [], totals: {} };
}, { permissions: [RBAC_PERMISSIONS.SOD_INVOICE] });
