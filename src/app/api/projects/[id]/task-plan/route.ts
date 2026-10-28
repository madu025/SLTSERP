import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { ProjectTaskPlanService } from '@/services/project/project-task-plan.service';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (_request, params) => {
    return ProjectTaskPlanService.getPlan(params.id);
}, {
    permissions: [RBAC_PERMISSIONS.PROJECT_PLAN_READ],
    rawResponse: true,
});

export const POST = apiHandler(async (_request, params, body) => {
    const actorId = params._userId;
    if (!actorId) throw AppError.unauthorized('Authenticated user required');
    const action = String(body.action || 'initialize');

    switch (action) {
        case 'initialize':
            return ProjectTaskPlanService.initialize(params.id, actorId);
        case 'sync_boq':
            return ProjectTaskPlanService.syncApprovedBoq(params.id, actorId);
        case 'add_template':
            if (!body.sourceTemplateId) throw AppError.badRequest('sourceTemplateId is required');
            return ProjectTaskPlanService.addTemplate(params.id, actorId, String(body.sourceTemplateId));
        case 'update_item':
            if (!body.itemId) throw AppError.badRequest('itemId is required');
            return ProjectTaskPlanService.updateItem(params.id, actorId, String(body.itemId), body);
        case 'remove_item':
            if (!body.itemId) throw AppError.badRequest('itemId is required');
            return ProjectTaskPlanService.removeItem(params.id, actorId, String(body.itemId));
        case 'reorder':
            if (!Array.isArray(body.orderedItemIds)) throw AppError.badRequest('orderedItemIds is required');
            return ProjectTaskPlanService.reorder(params.id, actorId, body.orderedItemIds.map(String));
        default:
            throw AppError.badRequest('Unsupported task plan action');
    }
}, {
    permissions: [RBAC_PERMISSIONS.PROJECT_PLAN_WRITE],
    audit: { action: 'CONFIGURE_PROJECT_TASK_PLAN', entity: 'PROJECT_TASK_PLAN' },
    rawResponse: true,
});
