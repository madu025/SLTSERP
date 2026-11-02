import { apiHandler } from '@/lib/api-handler';
import { ProjectExpenseService } from '@/services/project/project-expense.service';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';

export const dynamic = 'force-dynamic';
export const GET = apiHandler(async (_request, params) => {
    const { id: projectId } = await params;
    return await ProjectExpenseService.getExpenses(projectId);
}, { permissions: [RBAC_PERMISSIONS.PROJECT_FINANCE_READ], rawResponse: true });
