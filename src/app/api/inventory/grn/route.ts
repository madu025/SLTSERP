import { NextResponse } from 'next/server';
import { InventoryService } from '@/services/inventory.service';
import { createGRN } from '@/actions/inventory-actions';

// Create a new GRN (Goods Received Note)
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const result = await createGRN(body);

        if (result.success) {
            return NextResponse.json(result.data);
        } else {
            return NextResponse.json({ error: result.error }, { status: 400 });
        }
    } catch (error: any) {
        console.error("GRN Error", error);
        return NextResponse.json({ error: 'Failed to create GRN' }, { status: 500 });
    }
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const storeId = searchParams.get('storeId') || undefined;

        const grns = await InventoryService.getGRNs(storeId);
        return NextResponse.json(grns);
    } catch (error) {
        console.error("GRN Fetch Error", error);
        return NextResponse.json({ error: 'Failed to fetch GRNs' }, { status: 500 });
    }
}
