import { AppError } from '@/lib/error';
import { prisma } from '@/lib/prisma';

export interface CreateExpenseInput {
    projectId: string;
    type: string;
    description?: string;
    amount: string | number;
    date?: string | Date;
    invoiceRef?: string | null;
    remarks?: string | null;
}

export function parsePositiveExpenseAmount(amount: unknown): number {
    if (typeof amount === 'string' && amount.trim() === '') {
        throw AppError.badRequest('EXPENSE_AMOUNT_MUST_BE_POSITIVE');
    }

    const value = typeof amount === 'number' || typeof amount === 'string'
        ? Number(amount)
        : Number.NaN;

    if (!Number.isFinite(value) || value <= 0) {
        throw AppError.badRequest('EXPENSE_AMOUNT_MUST_BE_POSITIVE');
    }

    return value;
}

export class ProjectExpenseService {
    static async getExpenses(projectId: string) {
        return await prisma.projectExpense.findMany({
            // Voided rows are retained for audit but are never active costs.
            where: { projectId, amount: { gt: 0 } },
            orderBy: { date: 'desc' },
        });
    }

    /**
     * Create project expense and recalculate project cost metrics in a transaction
     */
    static async createExpense(data: CreateExpenseInput) {
        const { projectId, type, description, amount, date, invoiceRef, remarks } = data;
        const amountVal = parsePositiveExpenseAmount(amount);
        const expenseDate = date ? new Date(date) : new Date();

        if (Number.isNaN(expenseDate.getTime())) {
            throw AppError.badRequest('EXPENSE_DATE_INVALID');
        }

        return await prisma.$transaction(async (tx) => {
            const expense = await tx.projectExpense.create({
                data: {
                    projectId,
                    type,
                    description: description || '',
                    amount: amountVal,
                    date: expenseDate,
                    invoiceRef: invoiceRef || null,
                    remarks: remarks || null
                }
            });

            // Dynamically recalculate project actualCost and variance
            const [project, approvedMaterialIssue] = await Promise.all([
                tx.project.findUnique({ where: { id: projectId } }),
                tx.stockIssue.findFirst({
                    where: { projectId, status: 'APPROVED' },
                    select: { id: true },
                }),
            ]);

            // Stock issues do not preserve an immutable material unit cost.
            // Do not turn this expense-only subtotal into a misleading project
            // actual-cost total while material cost is unknown.
            if (project && !approvedMaterialIssue) {
                const newActualCost = Number(project.actualCost || 0) + amountVal;
                const newVariance = project.budget !== null && project.budget !== undefined
                    ? Number(project.budget) - newActualCost
                    : null;

                await tx.project.update({
                    where: { id: projectId },
                    data: {
                        actualCost: newActualCost,
                        variance: newVariance
                    }
                });
            }

            return expense;
        });
    }

    /**
     * Void project expense while retaining an on-record reason and original
     * amount. ProjectExpense has no status/audit columns, so zeroing the amount
     * avoids a destructive delete without creating a negative expense entry.
     */
    static async voidExpense(id: string, voidedById: string) {
        return await prisma.$transaction(async (tx) => {
            const expense = await tx.projectExpense.findUnique({
                where: { id }
            });

            if (!expense) {
                throw AppError.badRequest('EXPENSE_NOT_FOUND');
            }

            const projectId = expense.projectId;
            const expenseAmount = parsePositiveExpenseAmount(Number(expense.amount));
            const voidedAt = new Date();
            const voidAuditNote = `[VOIDED ${voidedAt.toISOString()} by ${voidedById}] Original amount: ${expense.amount.toString()}.`;

            await tx.projectExpense.update({
                where: { id },
                data: {
                    amount: 0,
                    remarks: [expense.remarks, voidAuditNote].filter(Boolean).join('\n'),
                },
            });

            // Dynamically recalculate project actualCost and variance
            const [project, approvedMaterialIssue] = await Promise.all([
                tx.project.findUnique({ where: { id: projectId } }),
                tx.stockIssue.findFirst({
                    where: { projectId, status: 'APPROVED' },
                    select: { id: true },
                }),
            ]);

            if (project && !approvedMaterialIssue) {
                const newActualCost = Math.max(0, Number(project.actualCost || 0) - expenseAmount);
                const newVariance = project.budget !== null && project.budget !== undefined
                    ? Number(project.budget) - newActualCost
                    : null;

                await tx.project.update({
                    where: { id: projectId },
                    data: {
                        actualCost: newActualCost,
                        variance: newVariance
                    }
                });
            }

            return { success: true, id, voidedAt: voidedAt.toISOString() };
        });
    }
}
