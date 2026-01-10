import { NextRequest, NextResponse } from 'next/server';
import { InventoryService } from '@/services/inventory.service';

export async function POST(req: NextRequest) {
    try {
        const data = await req.json();
        const { requestId, action, approvedById, remarks, allocation } = data;

        if (!requestId || !action || !approvedById) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        const result = await InventoryService.processStockRequestAction({
            requestId,
            action,
            approvedById,
            remarks,
            allocation
        });

        return NextResponse.json(result);
    } catch (error: any) {
        console.error('Action processing error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to process action' },
            { status: 500 }
        );
    }
}
