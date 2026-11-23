import { getAuthenticatedUserId } from '@/lib/request-context';
import { ProjectDashboardService } from '@/services/project/project-dashboard.service';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (request, params) => {
    const userId = getAuthenticatedUserId();

    if (!userId) {
        throw AppError.unauthorized('Unauthorized');
    }

    const section = new URL(request.url).searchParams.get('section');
    // the finance section needs project.finance.read (the finance people have no project.read for the general statistics, and the reverse)
    const held = params._permissions ?? [];
    if (section === 'financials' ? !held.includes(RBAC_PERMISSIONS.PROJECT_FINANCE_READ) : !held.includes(RBAC_PERMISSIONS.PROJECT_READ)) {
        throw AppError.forbidden('Missing the capability for this dashboard');
    }
    const data = section === 'financials'
        ? { financials: await ProjectDashboardService.getFinancialStats(userId) }
        : await ProjectDashboardService.getProjectStats(userId);
    return data;
}, { permissions: [RBAC_PERMISSIONS.PROJECT_READ, RBAC_PERMISSIONS.PROJECT_FINANCE_READ], rawResponse: true });
