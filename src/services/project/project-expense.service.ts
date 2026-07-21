import { AppError } from '@/lib/error';
import { prisma } from '@/lib/prisma';

interface CreateExpenseInput {
    projectId: string;
    type: string;
    description?: string;
    amount: string | number;
    date?: string | Date;
    invoiceRef?: string | null;
    remarks?: string | null;
}

export class ProjectExpenseService {
    static async getExpenses(projectId: string) {
        return await prisma.projectExpense.findMany({
            where: { projectId },
            orderBy: { date: 'desc' },
        });
    }

    /**
     * Create project expense and recalculate project cost metrics in a transaction
     */
    static async createExpense(data: CreateExpenseInput) {
        const { projectId, type, description, amount, date, invoiceRef, remarks } = data;
        const amountVal = parseFloat(String(amount));

        let expense;

        await prisma.$transaction(async (tx) => {
            expense = await tx.projectExpense.create({
                data: {
                    projectId,
                    type,
                    description: description || '',
                    amount: amountVal,
                    date: date ? new Date(date) : new Date(),
                    invoiceRef: invoiceRef || null,
                    remarks: remarks || null
                }
            });

            // Dynamically recalculate project actualCost and variance
            const project = await tx.project.findUnique({
                where: { id: projectId }
            });

            if (project) {
                const newActualCost = (project.actualCost || 0) + amountVal;
                const newVariance = project.budget !== null && project.budget !== undefined
                    ? project.budget - newActualCost
                    : null;

                await tx.project.update({
                    where: { id: projectId },
                    data: {
                        actualCost: newActualCost,
                        variance: newVariance
                    }
                });
            }
        });

        return expense;
    }

    /**
     * Delete project expense and decrement project cost metrics in a transaction
     */
    static async deleteExpense(id: string) {
        await prisma.$transaction(async (tx) => {
            const expense = await tx.projectExpense.findUnique({
                where: { id }
            });

            if (!expense) {
                throw AppError.badRequest('EXPENSE_NOT_FOUND');
            }

            const projectId = expense.projectId;
            const expenseAmount = expense.amount;

            await tx.projectExpense.delete({
                where: { id }
            });

            // Dynamically recalculate project actualCost and variance
            const project = await tx.project.findUnique({
                where: { id: projectId }
            });

            if (project) {
                const newActualCost = Math.max(0, (project.actualCost || 0) - expenseAmount);
                const newVariance = project.budget !== null && project.budget !== undefined
                    ? project.budget - newActualCost
                    : null;

                await tx.project.update({
                    where: { id: projectId },
                    data: {
                        actualCost: newActualCost,
                        variance: newVariance
                    }
                });
            }
        });

        return { success: true };
    }
}
