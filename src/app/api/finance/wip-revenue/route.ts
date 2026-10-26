import { SODWipRevenueService } from '@/services/finance/sod-wip-revenue.service';
import { apiHandler } from '@/lib/api-handler';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { resolveOpmcScope } from '@/lib/opmc-scope';

export const dynamic = 'force-dynamic';

// GET WIP Revenue Summary & Invoicable Pool
export const GET = apiHandler(async (request, params) => {
    const { searchParams } = new URL(request.url);
    const opmcId = searchParams.get('opmcId') || undefined;

    // Server-side OPMC scope — client opmcId is intersected with it inside
    // the service (admins unrestricted, empty scope denies all).
    const accessibleOpmcs = await resolveOpmcScope(params._userId);

    const data = await SODWipRevenueService.getWipSummary(opmcId, accessibleOpmcs);
    return data;
}, { permissions: [RBAC_PERMISSIONS.FINANCE_READ], rawResponse: true });
