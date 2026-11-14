import { apiHandler } from '@/lib/api-handler';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { SpendService } from '@/services/procurement/spend.service';

export const dynamic = 'force-dynamic';

// GET /api/procurement/spend
// Spend by month and expenditure type, and what is committed on open purchase orders, for the caller's stores and projects.
export const GET = apiHandler(async (_req, params) => SpendService.getSpend(params._userId ?? ''), {
    permissions: [RBAC_PERMISSIONS.PROCUREMENT_READ],
});
