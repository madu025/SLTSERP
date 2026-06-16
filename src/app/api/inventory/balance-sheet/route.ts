import { NextResponse } from 'next/server';
import { InventoryService } from '@/services/inventory.service';

// POST: Save/Freeze Balance Sheet
export async function POST(request: Request) {
    try {
        const userId = request.headers.get('x-user-id');
        if (!userId) {
            return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();

        const result = await InventoryService.saveBalanceSheet({
            ...body,
            userId
        });

        return NextResponse.json({ message: 'Balance sheet saved successfully', id: result.id });

    } catch (error: any) {
        if (error.message === 'MISSING_FIELDS') {
            return NextResponse.json({ message: 'Missing fields' }, { status: 400 });
        }

        console.error('Error saving balance sheet:', error);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}
