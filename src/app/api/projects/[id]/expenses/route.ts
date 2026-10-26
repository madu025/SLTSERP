import { apiHandler } from '@/lib/api-handler';
import { ProjectExpenseService } from '@/services/project/project-expense.service';
import { ROLE_GROUPS } from '@/config/roles';

export const dynamic = 'force-dynamic';
const PROJECT_FINANCE_READERS = [...new Set([...ROLE_GROUPS.PROJECT_MANAGERS, ...ROLE_GROUPS.FINANCE])];

export const GET = apiHandler(async (_request, params) => {
    const { id: projectId } = await params;
    return await ProjectExpenseService.getExpenses(projectId);
}, { roles: PROJECT_FINANCE_READERS, rawResponse: true });
