import { apiHandler } from '@/lib/api-handler';
import { BudgetTrackingService } from '@/services/budget-tracking.service';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (_request, params) => {
    const { id: projectId } = params;
    return await BudgetTrackingService.getBudgetDashboard(projectId);
}, { rawResponse: true });

export const POST = apiHandler(async (_request, params) => {
    const { id: projectId } = params;
    return await BudgetTrackingService.syncActualCost(projectId);
}, {
    audit: { action: 'SYNC_BUDGET', entity: 'PROJECT_BUDGET' },
    rawResponse: true
});
