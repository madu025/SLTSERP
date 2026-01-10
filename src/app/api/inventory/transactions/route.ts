import { NextResponse } from 'next/server';
import { InventoryService } from '@/services/inventory.service';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);

        const filters = {
            itemId: searchParams.get('itemId') || undefined,
            storeId: searchParams.get('storeId') || undefined,
            type: searchParams.get('type') || undefined,
            startDate: searchParams.get('startDate') || undefined,
            endDate: searchParams.get('endDate') || undefined,
        };

        const transactions = await InventoryService.getTransactions(filters);
        return NextResponse.json(transactions);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
    }
}
