import { NextResponse } from 'next/server';
import { ProjectExpenseService } from '@/services/project-expense.service';

// POST create expense
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { projectId, type, amount } = body;

        if (!projectId || !type || !amount) {
            return NextResponse.json(
                { error: 'Project ID, Type and Amount are required' },
                { status: 400 }
            );
        }

        const expense = await ProjectExpenseService.createExpense(body);
        return NextResponse.json(expense);
    } catch (error: unknown) {
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

        await ProjectExpenseService.deleteExpense(id);
        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        console.error('Error deleting expense:', error);
        const errorMsg = error instanceof Error ? error.message : '';
        if (errorMsg === 'EXPENSE_NOT_FOUND') {
            return NextResponse.json(
                { error: 'Expense not found' },
                { status: 404 }
            );
        }
        return NextResponse.json(
            { error: 'Failed to delete expense' },
            { status: 500 }
        );
    }
}
