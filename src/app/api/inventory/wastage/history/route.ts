
import { NextResponse } from 'next/server';
import { InventoryService } from '@/services/inventory';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const storeId = searchParams.get('storeId') || undefined;
        const contractorId = searchParams.get('contractorId') || undefined;
        const month = searchParams.get('month') || undefined;

        const data = await InventoryService.getWastageHistory({ storeId, contractorId, month });
        return NextResponse.json(data);
    } catch (error) {
        console.error("Wastage history error:", error);
        return NextResponse.json({ message: 'Error fetching wastage history' }, { status: 500 });
    }
}
