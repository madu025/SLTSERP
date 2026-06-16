import { NextResponse } from 'next/server';
import { InventoryService } from '@/services/inventory.service';
import { createStockRequest, processStockRequestAction } from '@/actions/inventory-actions';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const result = await createStockRequest(body);

        if (result.success) {
            return NextResponse.json(result.data);
        } else {
            return NextResponse.json({ error: result.error }, { status: 400 });
        }
    } catch (error) {
        console.error("Stock Request Creation Error:", error);
        return NextResponse.json({ error: 'Failed to create request' }, { status: 500 });
    }
}

// Approve / Reject / Allocate
export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        const result = await processStockRequestAction(body);

        if (result.success) {
            return NextResponse.json(result.data);
        } else {
            return NextResponse.json({ error: result.error }, { status: 400 });
        }
    } catch (error: any) {
        console.error("Stock Request Action Error:", error);
        return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
    }
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);

        const filters = {
            storeId: searchParams.get('storeId') || undefined,
            isApprover: searchParams.get('isApprover') === 'true',
            status: searchParams.get('status') || undefined,
            workflowStage: searchParams.get('workflowStage') || undefined
        };

        const requests = await InventoryService.getStockRequests(filters);
        return NextResponse.json(requests);

    } catch (error) {
        console.error("Stock Request Fetch Error:", error);
        return NextResponse.json({ error: 'Failed to fetch requests' }, { status: 500 });
    }
}
