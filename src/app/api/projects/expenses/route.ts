import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST create expense
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { projectId, type, description, amount, date, invoiceRef, remarks } = body;

        if (!projectId || !type || !amount) {
            return NextResponse.json(
                { error: 'Project ID, Type and Amount are required' },
                { status: 400 }
            );
        }

        let expense;

        await prisma.$transaction(async (tx) => {
            expense = await tx.projectExpense.create({
                data: {
                    projectId,
                    type,
                    description: description || '',
                    amount: parseFloat(amount),
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
                const newActualCost = (project.actualCost || 0) + parseFloat(amount);
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

        return NextResponse.json(expense);
    } catch (error) {
        console.error('Error creating expense:', error);
        return NextResponse.json(
            { error: 'Failed to create expense' },
            { status: 500 }
        );
    }
}

// DELETE expense
export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json(
                { error: 'Expense ID required' },
                { status: 400 }
            );
        }

        await prisma.$transaction(async (tx) => {
            const expense = await tx.projectExpense.findUnique({
                where: { id }
            });

            if (!expense) {
                throw new Error('Expense not found');
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

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting expense:', error);
        return NextResponse.json(
            { error: 'Failed to delete expense' },
            { status: 500 }
        );
    }
}
