import { apiHandler, castBody } from '@/lib/api-handler';
import { CreateExpenseInput, ProjectExpenseService } from '@/services/project/project-expense.service';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { databaseUuidSchema } from '@/lib/validations/uuid.schema';
import { assertProjectAccess } from '@/lib/project-access';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const expenseSchema = z.object({
    projectId: databaseUuidSchema,
    type: z.string().trim().min(1),
    description: z.string().optional(),
    amount: z.union([z.number(), z.string().trim().min(1)]),
    date: z.string().optional(),
    invoiceRef: z.string().optional().nullable(),
    remarks: z.string().optional().nullable(),
});

export const POST = apiHandler(async (_request, params, body) => {
    if (!params._userId) throw AppError.unauthorized('Authenticated user required to create an expense');
    const { projectId, type, amount } = body || {};

    if (!projectId || !type || !amount) {
        throw AppError.badRequest('Project ID, Type and Amount are required');
    }
    await assertProjectAccess(projectId, params._userId);

    return await ProjectExpenseService.createExpense(castBody<CreateExpenseInput>(body));
}, {
    schema: expenseSchema,
    permissions: [RBAC_PERMISSIONS.PROJECT_FINANCE_WRITE],
    audit: { action: 'CREATE', entity: 'PROJECT_EXPENSE' },
    rawResponse: true
});

export const DELETE = apiHandler(async (request, params) => {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
        throw AppError.badRequest('Expense ID required');
    }

    if (!params._userId) {
        throw AppError.unauthorized('Authenticated user required to void an expense');
    }
    const expense = await prisma.projectExpense.findUnique({ where: { id }, select: { projectId: true } });
    if (!expense) throw AppError.notFound('Expense not found');
    await assertProjectAccess(expense.projectId, params._userId);

    try {
        return await ProjectExpenseService.voidExpense(id, params._userId);
    } catch (error: unknown) {
        const errorMsg = error instanceof Error ? error.message : '';
        if (errorMsg === 'EXPENSE_NOT_FOUND') {
            throw AppError.notFound('Expense not found');
        }
        throw error;
    }
}, {
    permissions: [RBAC_PERMISSIONS.PROJECT_FINANCE_APPROVE],
    audit: { action: 'DELETE', entity: 'PROJECT_EXPENSE' },
    rawResponse: true
});
