import { apiHandler } from '@/lib/api-handler';
import { BudgetTrackingService } from '@/services/finance/budget-tracking.service';
import { ROLE_GROUPS } from '@/config/roles';

export const dynamic = 'force-dynamic';
const PROJECT_FINANCE_READERS = [...new Set([...ROLE_GROUPS.PROJECT_MANAGERS, ...ROLE_GROUPS.FINANCE])];

export const GET = apiHandler(async (_request, params) => {
    const { id: projectId } = params;
    return await BudgetTrackingService.getBudgetDashboard(projectId);
}, { roles: PROJECT_FINANCE_READERS, rawResponse: true });

export const POST = apiHandler(async (_request, params) => {
    const { id: projectId } = params;
    return await BudgetTrackingService.syncActualCost(projectId);
}, {
    roles: ROLE_GROUPS.FINANCE_APPROVERS,
    audit: { action: 'SYNC_BUDGET', entity: 'PROJECT_BUDGET' },
    rawResponse: true
});
