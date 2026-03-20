
import { NextResponse } from 'next/server';
import { InventoryService } from '@/services/inventory';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const contractorId = searchParams.get('contractorId') || undefined;
        const itemId = searchParams.get('itemId') || undefined;

        const data = await InventoryService.getInHandStock({ contractorId, itemId });
        return NextResponse.json(data);
    } catch (error) {
        console.error("In-hand stock error:", error);
        return NextResponse.json({ message: 'Error fetching in-hand stock' }, { status: 500 });
    }
}
