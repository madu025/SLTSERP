import { ServiceOrderDashboardService } from '@/services/service-order/sod-dashboard.service';
import { apiHandler } from '@/lib/api-handler';
import { withTracing } from '@/lib/tracing-utils';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (request) => {
    const { searchParams } = new URL(request.url);
    // Identity MUST come from the session header set by middleware — never
    // trust a client-supplied ?userId (impersonation vector). The param is
    // only accepted for backward compatibility and must equal the session
    // user.
    const userId = request.headers.get('x-user-id');
    const queryUserId = searchParams.get('userId');

    if (!userId) {
        throw AppError.unauthorized('Unauthorized');
    }

    if (queryUserId && queryUserId !== userId) {
        throw AppError.forbidden('userId parameter does not match the authenticated session');
    }

    const filterRegion = searchParams.get('region') || 'ALL';
    const filterRtom = searchParams.get('rtom') || 'ALL';

    const data = await ServiceOrderDashboardService.getServiceOrderStats({
        userId,
        filterRegion,
        filterRtom
    });

    return data;
}, {
    // Role gate first: apiHandler RBAC runs before the handler body, so role
    // denial precedes the userId session check. Resolved dynamically from the
    // /dashboard sidebar entry (the page that renders these SO stats).
    menuPath: '/dashboard',
    rawResponse: true
});
