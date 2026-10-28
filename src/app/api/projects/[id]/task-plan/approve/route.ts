import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { ProjectTaskPlanService } from '@/services/project/project-task-plan.service';

export const dynamic = 'force-dynamic';

export const POST = apiHandler(async (_request, params) => {
    if (!params._userId) throw AppError.unauthorized('Authenticated user required');
    return ProjectTaskPlanService.finalize(params.id, params._userId);
}, {
    permissions: [RBAC_PERMISSIONS.PROJECT_PLAN_APPROVE],
    audit: { action: 'APPROVE_PROJECT_TASK_PLAN', entity: 'PROJECT_TASK_PLAN' },
    rawResponse: true,
});
