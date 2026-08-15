import { ROLE_GROUPS } from '@/config/roles';
export const dynamic = 'force-dynamic';

import { apiHandler } from '@/lib/api-handler';
import { FinanceDashboardService } from '@/services/finance/dashboard.service';
import { resolveOpmcScope } from '@/lib/opmc-scope';

// GET /api/admin/finance/dashboard - Fetch aggregated metrics and charts data
export const GET = apiHandler(async (req, params) => {
    const accessibleOpmcs = await resolveOpmcScope(params._userId);
    const { searchParams } = new URL(req.url);
    const rtom = searchParams.get('rtom') || 'ALL';

    const data = await FinanceDashboardService.getDashboardMetrics(rtom, accessibleOpmcs);
    return data;
}, {
    roles: ROLE_GROUPS.FINANCE_APPROVERS
});
