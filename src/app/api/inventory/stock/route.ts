import { NextResponse } from 'next/server';
import { InventoryService } from '@/services/inventory.service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const storeId = searchParams.get('storeId');

        if (!storeId) {
            return NextResponse.json({ error: 'Store ID is required' }, { status: 400 });
        }

        const stock = await InventoryService.getStock(storeId);
        return NextResponse.json(stock);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch stock' }, { status: 500 });
    }
}

// POST: Bulk Update / Initialize Stock
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { storeId, items, reason, userId } = body;

        const result = await InventoryService.initializeStock(storeId, items, reason, userId);
        return NextResponse.json({ message: 'Stock updated successfully', itemsUpdated: result });

    } catch (error: any) {
        if (error.message === 'INVALID_PAYLOAD') {
            return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
        }

        console.error("Stock Update Error:", error);
        return NextResponse.json({ error: 'Failed to update stock' }, { status: 500 });
    }
}
