import { NextRequest, NextResponse } from 'next/server';
import { ProjectGoodsReceiptService } from '@/services/project-goods-receipt.service';

// GET /api/projects/goods-receipts?projectId=xxx - List GRs by project
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get('projectId');
        const poId = searchParams.get('poId');

        if (!projectId && !poId) {
            return NextResponse.json({ error: 'projectId or poId is required' }, { status: 400 });
        }

        const goodsReceipts = await ProjectGoodsReceiptService.getGoodsReceipts(projectId, poId);
        return NextResponse.json(goodsReceipts);
    } catch (error: unknown) {
        console.error('Error fetching goods receipts:', error);
        return NextResponse.json({ error: 'Failed to fetch goods receipts' }, { status: 500 });
    }
}

// POST /api/projects/goods-receipts - Create a new goods receipt
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            poId,
            projectId,
            receivedById,
            items,
        } = body;

        // Validate required fields
        if (!poId || !projectId || !receivedById || !items?.length) {
            return NextResponse.json(
                { error: 'poId, projectId, receivedById, and items are required' },
                { status: 400 }
            );
        }

        const goodsReceipt = await ProjectGoodsReceiptService.createGoodsReceipt(body);
        return NextResponse.json(goodsReceipt, { status: 201 });
    } catch (error: unknown) {
        console.error('Error creating goods receipt:', error);
        const errorMsg = error instanceof Error ? error.message : '';
        if (errorMsg === 'PURCHASE_ORDER_NOT_FOUND') {
            return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
        }
        const errorCode = (error as { code?: string }).code;
        if (errorCode === 'P2002') {
            return NextResponse.json({ error: 'GRN number already exists' }, { status: 400 });
        }
        return NextResponse.json({ error: 'Failed to create goods receipt' }, { status: 500 });
    }
}

// PATCH /api/projects/goods-receipts - Approve/reject goods receipt
export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json();
        const { id, status, approvedById } = body;

        if (!id || !status) {
            return NextResponse.json({ error: 'id and status are required' }, { status: 400 });
        }

        const goodsReceipt = await ProjectGoodsReceiptService.updateGoodsReceiptStatus(id, status, approvedById);
        return NextResponse.json(goodsReceipt);
    } catch (error: unknown) {
        console.error('Error updating goods receipt:', error);
        const errorMsg = error instanceof Error ? error.message : '';
        if (errorMsg === 'INVALID_STATUS') {
            return NextResponse.json({ error: 'Invalid status transition' }, { status: 400 });
        }
        return NextResponse.json({ error: 'Failed to update goods receipt' }, { status: 500 });
    }
}
