import { apiHandler } from '@/lib/api-handler';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { HoMonthlyService } from '@/services/finance/ho-monthly.service';

export const dynamic = 'force-dynamic';

// GET /api/finance/ho/monthly?month=YYYY-MM - payables due up to the end of the month and where each stands with Head Office
export const GET = apiHandler(async (req, params) => {
    const month = new URL(req.url).searchParams.get('month') || undefined;
    return HoMonthlyService.plan(params._userId ?? '', month);
}, { permissions: [RBAC_PERMISSIONS.FINANCE_READ] });
