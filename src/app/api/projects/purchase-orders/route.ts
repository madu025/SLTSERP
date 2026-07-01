import { NextRequest, NextResponse } from 'next/server';
import { ProjectPurchaseOrderService } from '@/services/project-purchase-order.service';

// GET /api/projects/purchase-orders?projectId=xxx - List POs by project
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get('projectId');

        if (!projectId) {
            return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
        }

        const purchaseOrders = await ProjectPurchaseOrderService.getPurchaseOrders(projectId);
        return NextResponse.json(purchaseOrders);
    } catch (error: unknown) {
        console.error('Error fetching purchase orders:', error);
        return NextResponse.json({ error: 'Failed to fetch purchase orders' }, { status: 500 });
    }
}

// POST /api/projects/purchase-orders - Create a new PO with items
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            projectId,
            vendorId,
            title,
            items,
        } = body;

        // Validate required fields
        if (!projectId || !vendorId || !title || !items?.length) {
            return NextResponse.json(
                { error: 'projectId, vendorId, title, and items are required' },
                { status: 400 }
            );
        }

        const purchaseOrder = await ProjectPurchaseOrderService.createPurchaseOrder(body);
        return NextResponse.json(purchaseOrder, { status: 201 });
    } catch (error: unknown) {
        console.error('Error creating purchase order:', error);
        const errorMsg = error instanceof Error ? error.message : '';
        if (errorMsg === 'PROJECT_NOT_FOUND') {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }
        const errorCode = (error as { code?: string }).code;
        if (errorCode === 'P2002') {
            return NextResponse.json({ error: 'Purchase order number already exists' }, { status: 400 });
        }
        return NextResponse.json({ error: 'Failed to create purchase order' }, { status: 500 });
    }
}

// PATCH /api/projects/purchase-orders - Update PO status
export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json();
        const { id, status, approvedById, issuedById, closedById, cancellationReason } = body;

        if (!id || !status) {
            return NextResponse.json({ error: 'id and status are required' }, { status: 400 });
        }

        const purchaseOrder = await ProjectPurchaseOrderService.updatePurchaseOrderStatus(id, status, {
            approvedById,
            issuedById,
            closedById,
            cancellationReason
        });

        return NextResponse.json(purchaseOrder);
    } catch (error: unknown) {
        console.error('Error updating purchase order:', error);
        const errorMsg = error instanceof Error ? error.message : '';
        if (errorMsg === 'PURCHASE_ORDER_NOT_FOUND') {
            return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
        }
        if (errorMsg === 'APPROVED_BY_ID_REQUIRED') {
            return NextResponse.json({ error: 'approvedById is required' }, { status: 400 });
        }
        if (errorMsg === 'ISSUED_BY_ID_REQUIRED') {
            return NextResponse.json({ error: 'issuedById is required' }, { status: 400 });
        }
        if (errorMsg === 'CLOSED_BY_ID_REQUIRED') {
            return NextResponse.json({ error: 'closedById is required' }, { status: 400 });
        }
        return NextResponse.json({ error: 'Failed to update purchase order' }, { status: 500 });
    }
}

// DELETE /api/projects/purchase-orders - Delete a PO (DRAFT only)
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'id is required' }, { status: 400 });
        }

        await ProjectPurchaseOrderService.deletePurchaseOrder(id);
        return NextResponse.json({ message: 'Purchase order deleted successfully' });
    } catch (error: unknown) {
        console.error('Error deleting purchase order:', error);
        const errorMsg = error instanceof Error ? error.message : '';
        if (errorMsg === 'PURCHASE_ORDER_NOT_FOUND') {
            return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
        }
        if (errorMsg === 'DRAFT_ONLY_DELETION') {
            return NextResponse.json({ error: 'Only DRAFT purchase orders can be deleted' }, { status: 400 });
        }
        return NextResponse.json({ error: 'Failed to delete purchase order' }, { status: 500 });
    }
}
