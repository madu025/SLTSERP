import { NextResponse } from 'next/server';
import { InventoryService } from '@/services/inventory.service';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const req = await InventoryService.createStockRequest(body);
        return NextResponse.json(req);
    } catch (error) {
        console.error("Stock Request Creation Error:", error);
        return NextResponse.json({ error: 'Failed to create request' }, { status: 500 });
    }
}

// Approve / Reject / Allocate
export async function PATCH(request: Request) {
    try {
        const body = await request.json();

        const result = await InventoryService.processStockRequestAction(body);
        return NextResponse.json(result);

    } catch (error: any) {
        console.error("Stock Request Action Error:", error);

        if (error.message === 'REQUEST_NOT_FOUND') {
            return NextResponse.json({ error: 'Request not found' }, { status: 404 });
        }
        if (error.message === 'INVALID_ACTION') {
            return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }

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
