import { apiHandler } from '@/lib/api-handler';
import { ReportService } from '@/services/core/report.service';
import { AppError } from '@/lib/error';
import { z } from 'zod';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';

export const dynamic = 'force-dynamic';

const VALID_PERIODS = ['Daily', 'Weekly', '1M', '3M', '6M', '1Y', 'CUSTOM'] as const;
const VALID_VIEWS = ['manager', 'area'] as const;
const VALID_GROUP_BY = ['REGION', 'ARM', 'RTOM', 'COORDINATOR'] as const;

export const GET = apiHandler(async (request, params) => {
    const { searchParams } = new URL(request.url);
    const view = searchParams.get('view') || 'manager';
    const period = searchParams.get('period') || '6M';
    const customFrom = searchParams.get('from');
    const customTo = searchParams.get('to');
    const groupBy = searchParams.get('groupBy') || 'RTOM';

    // Zod validation
    const queryParams = z.object({
        view: z.enum(VALID_VIEWS),
        period: z.enum(VALID_PERIODS),
        groupBy: z.enum(VALID_GROUP_BY),
        from: z.string().regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/).nullable().optional(),
        to: z.string().regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/).nullable().optional(),
    }).safeParse({ view, period, groupBy, from: customFrom, to: customTo });

    if (!queryParams.success) {
        throw AppError.badRequest(`Invalid query parameters: ${queryParams.error.issues.map(i => i.message).join(', ')}`);
    }

    // The route-level capability authenticates the report module. The view
    // capability remains separate so a manager-view caller cannot switch to
    // an area view (or vice versa) by changing a client role label.
    const viewPermission = view === 'manager'
        ? RBAC_PERMISSIONS.REPORTS_MANAGER_READ
        : RBAC_PERMISSIONS.REPORTS_AREA_READ;
    if (!params._userId) throw AppError.unauthorized('Authentication required');
    if (!params._permissions.includes(viewPermission)) {
        throw AppError.forbidden(`You do not have access to the ${view} view`);
    }

    return await ReportService.getAnalyticsReport(view, period, {
        customFrom,
        customTo,
        groupBy
    });
}, { rawResponse: true, permissions: [RBAC_PERMISSIONS.REPORTS_READ] });
