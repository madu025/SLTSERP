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
    const data = section === 'financials'
        ? { financials: await ProjectDashboardService.getFinancialStats(userId) }
        : await ProjectDashboardService.getProjectStats(userId);
    return data;
}, { permissions: [RBAC_PERMISSIONS.PROJECT_READ], rawResponse: true });
