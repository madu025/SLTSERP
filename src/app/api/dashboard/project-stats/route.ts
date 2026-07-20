import { ProjectDashboardService } from '@/services/project-dashboard.service';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (request) => {
    const userId = request.headers.get('x-user-id');
    const userRole = request.headers.get('x-user-role');

    if (!userId || !userRole) {
        throw AppError.unauthorized('Unauthorized');
    }

    const data = await ProjectDashboardService.getProjectStats(userId, userRole);
    return data;
}, { rawResponse: true });