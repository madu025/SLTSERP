import { ProjectDashboardService } from '@/services/project/project-dashboard.service';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (request, params) => {
    const userId = params._userId;
    const userRole = params._userRole;

    if (!userId || !userRole) {
        throw AppError.unauthorized('Unauthorized');
    }

    const { searchParams } = new URL(request.url);
    const fullView = searchParams.get('view') === 'full';
    const includeRecentActivities = searchParams.get('includeRecentActivities') !== 'false';
    const data = fullView
        ? await ProjectDashboardService.getProjectOverview(userId, userRole)
        : await ProjectDashboardService.getProjectOverviewSummary(userId, userRole, { includeRecentActivities });
    return data;
}, { permissions: [RBAC_PERMISSIONS.PROJECT_READ], rawResponse: true });
