import { NextResponse } from 'next/server';
import { InventoryService } from '@/services/inventory.service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const storeId = searchParams.get('storeId');
        const contractorId = searchParams.get('contractorId');
        const itemId = searchParams.get('itemId') || undefined;

        if (storeId) {
            const batches = await InventoryService.getStoreBatches(storeId, itemId);
            return NextResponse.json(batches);
        }

        if (contractorId) {
            const batches = await InventoryService.getContractorBatches(contractorId, itemId);
            return NextResponse.json(batches);
        }

        return NextResponse.json({ error: 'Store ID or Contractor ID is required' }, { status: 400 });
    } catch (error) {
        console.error("Batches Fetch Error:", error);
        return NextResponse.json({ error: 'Failed to fetch batches' }, { status: 500 });
    }
}
