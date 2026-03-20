
import { NextResponse } from 'next/server';
import { InventoryService } from '@/services/inventory';

export async function GET(request: Request) {
    try {
        const summary = await InventoryService.getTransitionSummary();
        return NextResponse.json(summary);
    } catch (error) {
        console.error("Virtual swap summary error:", error);
        return NextResponse.json({ message: 'Error fetching transition summary' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const userId = request.headers.get('x-user-id') || 'SYSTEM';
        const result = await InventoryService.executeBulkSwap(userId);
        return NextResponse.json(result);
    } catch (error) {
        console.error("Virtual swap execution error:", error);
        return NextResponse.json({ message: 'Error executing virtual swap' }, { status: 500 });
    }
}
