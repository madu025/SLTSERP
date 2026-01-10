import { NextResponse } from 'next/server';
import { InventoryService } from '@/services/inventory.service';

export const dynamic = 'force-dynamic';

// Create MRN (Material Return Note)
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const result = await InventoryService.createMRN(body);
        return NextResponse.json(result);
    } catch (error) {
        console.error("MRN Creation Error:", error);
        return NextResponse.json({ error: 'Failed to create MRN' }, { status: 500 });
    }
}

// Get MRNs
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const storeId = searchParams.get('storeId') || undefined;
        const status = searchParams.get('status') || undefined;

        const mrns = await InventoryService.getMRNs(storeId, status);
        return NextResponse.json(mrns);
    } catch (error) {
        console.error("MRN Fetch Error:", error);
        return NextResponse.json({ error: 'Failed to fetch MRNs' }, { status: 500 });
    }
}

// Approve/Reject MRN
export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        const { mrnId, action, approvedById } = body;

        const result = await InventoryService.updateMRNStatus(mrnId, action, approvedById);
        return NextResponse.json(result);

    } catch (error: any) {
        if (error.message === 'MRN_NOT_FOUND') {
            return NextResponse.json({ error: 'MRN not found' }, { status: 404 });
        }
        if (error.message === 'INVALID_ACTION') {
            return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }

        console.error("MRN Approval Error:", error);
        return NextResponse.json({ error: 'Failed to process MRN' }, { status: 500 });
    }
}
