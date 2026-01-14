import { NextResponse } from 'next/server';
import { InventoryService } from '@/services/inventory.service';

// POST: Issue materials to a contractor
export async function POST(request: Request) {
    try {
        const role = request.headers.get('x-user-role');
        const userEmail = request.headers.get('x-user-id');

        if (!role || !['STORES_MANAGER', 'STORES_ASSISTANT', 'SUPER_ADMIN', 'ADMIN'].includes(role)) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { materialIssueSchema } = await import('@/lib/validations');

        try {
            const validatedData = materialIssueSchema.parse(body);
            const issue = await InventoryService.issueMaterial({
                ...validatedData,
                items: validatedData.items.map(i => ({ ...i, quantity: i.quantity.toString() })), // Keep service compatibility
                userId: userEmail || undefined
            });

            return NextResponse.json({ message: 'Materials issued successfully and inventory updated', issueId: issue.id });
        } catch (validationErr: any) {
            return NextResponse.json({ message: validationErr.errors?.[0]?.message || 'Invalid data', errors: validationErr.errors }, { status: 400 });
        }

    } catch (error: any) {
        if (error.message === 'MISSING_FIELDS') {
            return NextResponse.json({ message: 'Missing required fields' }, { status: 400 });
        }
        if (error.message.startsWith('ITEM_NOT_FOUND')) {
            return NextResponse.json({ message: error.message }, { status: 404 });
        }
        if (error.message.startsWith('INSUFFICIENT_STOCK')) {
            return NextResponse.json({ message: error.message }, { status: 400 });
        }

        console.error('Material Issue Error:', error);
        return NextResponse.json({
            message: error.message || 'Internal Server Error'
        }, { status: 500 });
    }
}

// GET: Fetch Data (e.g., previous issues for a month/contractor)
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const contractorId = searchParams.get('contractorId');
        const month = searchParams.get('month');

        if (!contractorId) {
            return NextResponse.json({ message: 'Contractor ID required' }, { status: 400 });
        }

        const issues = await InventoryService.getMaterialIssues(contractorId, month || undefined);
        return NextResponse.json(issues);
    } catch (error) {
        console.error('Fetch Issue Error:', error);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}
