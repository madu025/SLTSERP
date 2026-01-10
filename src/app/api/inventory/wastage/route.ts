import { NextResponse } from 'next/server';
import { InventoryService } from '@/services/inventory.service';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const userId = request.headers.get('x-user-id') || 'SYSTEM';

        const result = await InventoryService.recordWastage({
            ...body,
            userId
        });

        return NextResponse.json(result);

    } catch (error: any) {
        if (error.message === 'STORE_ID_REQUIRED_FOR_STORE_WASTAGE') {
            return NextResponse.json({ error: 'Store ID required for Store Wastage' }, { status: 400 });
        }

        console.error("Wastage Error:", error);
        return NextResponse.json({ error: 'Failed to record wastage' }, { status: 500 });
    }
}
