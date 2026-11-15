import { apiHandler } from '@/lib/api-handler';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { HoFundingService } from '@/services/finance/ho-funding.service';

export const dynamic = 'force-dynamic';

// GET /api/finance/ho/account?from=&to=  - the current account with Head Office (HO-2020) with a running balance
export const GET = apiHandler(async (req, params) => {
    const sp = new URL(req.url).searchParams;
    return HoFundingService.account(params._userId ?? '', sp.get('from') || undefined, sp.get('to') || undefined);
}, { permissions: [RBAC_PERMISSIONS.FINANCE_READ] });
