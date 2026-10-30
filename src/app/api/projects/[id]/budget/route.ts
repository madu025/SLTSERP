import { apiHandler } from '@/lib/api-handler';
import { BudgetTrackingService } from '@/services/finance/budget-tracking.service';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { assertProjectAccess } from '@/lib/project-access';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (_request, params) => {
    const { id: projectId } = params;
    await assertProjectAccess(projectId, params._userId);
    return await BudgetTrackingService.getBudgetDashboard(projectId);
}, { permissions: [RBAC_PERMISSIONS.PROJECT_FINANCE_READ], rawResponse: true });

export const POST = apiHandler(async (_request, params) => {
    const { id: projectId } = params;
    await assertProjectAccess(projectId, params._userId);
    return await BudgetTrackingService.syncActualCost(projectId);
}, {
    permissions: [RBAC_PERMISSIONS.PROJECT_FINANCE_APPROVE],
    audit: { action: 'SYNC_BUDGET', entity: 'PROJECT_BUDGET' },
    rawResponse: true
});
