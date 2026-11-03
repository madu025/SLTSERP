import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { ProjectFinanceNotificationService } from '@/services/project/project-finance-notification.service';
import { ProjectTaskNotificationService } from '@/services/project/project-task-notification.service';

export const dynamic = 'force-dynamic';

// GET /api/projects/my-tasks - everything waiting on the signed-in user: open project and field
// tasks, plus invoice work derived from their project finance roles. Limited to their OPMC scope.
export const GET = apiHandler(async (_req, params) => {
    if (!params._userId) throw AppError.unauthorized('Authentication required');
    const [work, financeWork] = await Promise.all([
        ProjectTaskNotificationService.listForUser(params._userId),
        ProjectFinanceNotificationService.listWorkForUser(params._userId),
    ]);
    return { ...work, financeWork };
}, {
    permissions: [RBAC_PERMISSIONS.PROJECT_READ],
    rawResponse: true,
});
