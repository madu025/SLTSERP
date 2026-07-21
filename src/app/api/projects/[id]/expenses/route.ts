import { apiHandler } from '@/lib/api-handler';
import { ProjectExpenseService } from '@/services/project/project-expense.service';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (_request, params) => {
    const { id: projectId } = await params;
    return await ProjectExpenseService.getExpenses(projectId);
}, { rawResponse: true });
