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

        const expense = await prisma.projectExpense.create({
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

        // Update Project Actual Cost (Trigger logic could be here, but simpler to just fetch sum)
        // Optionally we could update the project.actualCost here directly:
        /*
        const totalExpenses = await prisma.projectExpense.aggregate({
            where: { projectId },
            _sum: { amount: true }
        });
        // We would also need to add BOQ Actuals to this sum... complex.
        // Better to calc on the fly or distinct update route.
        */

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

        await prisma.projectExpense.delete({
            where: { id }
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
