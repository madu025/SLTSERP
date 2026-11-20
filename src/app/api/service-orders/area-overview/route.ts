import { apiHandler } from '@/lib/api-handler';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { AreaOverviewService } from '@/services/service-order/area-overview.service';

export const dynamic = 'force-dynamic';

// GET /api/service-orders/area-overview - the caller's own RTOMs: orders with contractors, and each contractor's progress (read-only, own area only)
export const GET = apiHandler(async (_req, params) => (await AreaOverviewService.forUser(params._userId ?? '')) ?? { areas: [], month: '', totals: { notAssigned: 0, inHand: 0, completedThisMonth: 0, returnedThisMonth: 0 }, contractors: [] }, { permissions: [RBAC_PERMISSIONS.SOD_READ] });
