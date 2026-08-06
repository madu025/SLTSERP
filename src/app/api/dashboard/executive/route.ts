import { ExecutiveDashboardService } from '@/services/core/executive-dashboard.service';
import { apiHandler } from '@/lib/api-handler';
import { ROLE_GROUPS } from '@/config/roles';
import { resolveOpmcScope } from '@/lib/opmc-scope';

export const dynamic = 'force-dynamic';

// GET /api/dashboard/executive
export const GET = apiHandler(async (request, params) => {
    const { searchParams } = new URL(request.url);
    const opmcIdsParam = searchParams.get('opmcIds');
    const clientOpmcIds = opmcIdsParam
        ? opmcIdsParam.split(',').map(s => s.trim()).filter(Boolean)
        : undefined;

    // OPMC scope is resolved server-side — the client-supplied list is never
    // trusted on its own. Client values are intersected with the caller's
    // resolved scope (admins unrestricted, empty scope denies all).
    const scope = await resolveOpmcScope(params._userId);
    const opmcIds = scope === undefined
        ? clientOpmcIds
        : clientOpmcIds
            ? clientOpmcIds.filter(id => scope.includes(id))
            : scope;

    const data = await ExecutiveDashboardService.getDashboardData(opmcIds);
    return data;
}, { roles: ROLE_GROUPS.ADMINS, rawResponse: true });
