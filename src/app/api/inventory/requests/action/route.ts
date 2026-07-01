import { NextRequest, NextResponse } from 'next/server';
import { InventoryService } from '@/services/inventory.service';
import { requireAuth } from '@/lib/server-utils';

export async function POST(req: NextRequest) {
    try {
        const user = await requireAuth(['STORES_MANAGER', 'OSP_MANAGER', 'ADMIN', 'SUPER_ADMIN', 'STORES_ASSISTANT', 'AREA_MANAGER']);
        const data = await req.json();
        const { requestId, action, remarks, allocation } = data;

        if (!requestId || !action) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        const result = await InventoryService.processStockRequestAction({
            requestId,
            action,
            userId: user.id,
            remarks,
            items: allocation
        });

        return NextResponse.json(result);
    } catch (error: unknown) {
        console.error('Action processing error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to process action' },
            { status: 500 }
        );
    }
}

