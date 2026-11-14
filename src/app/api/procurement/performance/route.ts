import { apiHandler } from '@/lib/api-handler';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { ProcurementPerformanceService } from '@/services/procurement/procurement-performance.service';

export const dynamic = 'force-dynamic';

// GET /api/procurement/performance
// Late purchase orders, approval waiting times, lead time and project PO funnel, limited to the caller's stores and OPMCs.
export const GET = apiHandler(async (_req, params) => ProcurementPerformanceService.getReport(params._userId ?? ''), {
    permissions: [RBAC_PERMISSIONS.PROCUREMENT_READ],
});
