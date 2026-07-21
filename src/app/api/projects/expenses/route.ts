import { apiHandler } from '@/lib/api-handler';
import { ProjectExpenseService } from '@/services/project/project-expense.service';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

export const POST = apiHandler(async (_request, _params, body) => {
    const { projectId, type, amount } = body || {};

    if (!projectId || !type || !amount) {
        throw AppError.badRequest('Project ID, Type and Amount are required');
    }

    return await ProjectExpenseService.createExpense(body);
}, {
    audit: { action: 'CREATE', entity: 'PROJECT_EXPENSE' },
    rawResponse: true
});

export const DELETE = apiHandler(async (request) => {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
        throw AppError.badRequest('Expense ID required');
    }

    try {
        await ProjectExpenseService.deleteExpense(id);
        return { success: true };
    } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : '';
        if (errorMsg === 'EXPENSE_NOT_FOUND') {
            throw AppError.notFound('Expense not found');
        }
        throw error;
    }
}, {
    audit: { action: 'DELETE', entity: 'PROJECT_EXPENSE' },
    rawResponse: true
});
