import { NextRequest, NextResponse } from 'next/server';
import { ProjectChangeOrderService } from '@/services/project-change-order.service';

// GET /api/projects/change-orders?projectId=xxx - List change orders by project
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get('projectId');

        if (!projectId) {
            return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
        }

        const changeOrders = await ProjectChangeOrderService.getChangeOrders(projectId);
        return NextResponse.json(changeOrders);
    } catch (error: unknown) {
        console.error('Error fetching change orders:', error);
        return NextResponse.json({ error: 'Failed to fetch change orders' }, { status: 500 });
    }
}

// POST /api/projects/change-orders - Create a new change order
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { projectId, title } = body;

        if (!projectId || !title) {
            return NextResponse.json(
                { error: 'projectId and title are required' },
                { status: 400 }
            );
        }

        const changeOrder = await ProjectChangeOrderService.createChangeOrder(body);
        return NextResponse.json(changeOrder, { status: 201 });
    } catch (error: unknown) {
        console.error('Error creating change order:', error);
        const errorMsg = error instanceof Error ? error.message : '';
        if (errorMsg === 'PROJECT_NOT_FOUND') {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }
        return NextResponse.json({ error: 'Failed to create change order' }, { status: 500 });
    }
}

// PATCH /api/projects/change-orders - Update change order status or details
export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json();
        const { id, action, ...updateData } = body;

        if (!id) {
            return NextResponse.json({ error: 'id is required' }, { status: 400 });
        }

        const updated = await ProjectChangeOrderService.updateChangeOrder(id, action, updateData);
        return NextResponse.json(updated);
    } catch (error: unknown) {
        console.error('Error updating change order:', error);
        const errorMsg = error instanceof Error ? error.message : '';
        if (errorMsg === 'CHANGE_ORDER_NOT_FOUND') {
            return NextResponse.json({ error: 'Change order not found' }, { status: 404 });
        }
        if (errorMsg === 'INVALID_STATUS_DRAFT_ONLY') {
            return NextResponse.json({ error: 'Only DRAFT can be submitted' }, { status: 400 });
        }
        if (errorMsg === 'INVALID_STATUS_PENDING_ONLY') {
            return NextResponse.json({ error: 'Only PENDING_APPROVAL can be approved or rejected' }, { status: 400 });
        }
        if (errorMsg === 'INVALID_STATUS_APPROVED_ONLY') {
            return NextResponse.json({ error: 'Only APPROVED can be implemented' }, { status: 400 });
        }
        if (errorMsg === 'CANNOT_CANCEL_COMPLETED') {
            return NextResponse.json({ error: 'Cannot cancel an implemented or already cancelled change order' }, { status: 400 });
        }
        if (errorMsg === 'CAN_ONLY_UPDATE_DRAFT_PENDING') {
            return NextResponse.json({ error: 'Can only update DRAFT or PENDING_APPROVAL change orders' }, { status: 400 });
        }
        if (errorMsg === 'INVALID_ACTION') {
            return NextResponse.json({ error: 'Invalid action. Use SUBMIT, APPROVE, REJECT, IMPLEMENT, CANCEL, or UPDATE' }, { status: 400 });
        }
        return NextResponse.json({ error: 'Failed to update change order' }, { status: 500 });
    }
}

// DELETE /api/projects/change-orders - Delete a change order (DRAFT only)
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'id is required' }, { status: 400 });
        }

        await ProjectChangeOrderService.deleteChangeOrder(id);
        return NextResponse.json({ message: 'Change order deleted' });
    } catch (error: unknown) {
        console.error('Error deleting change order:', error);
        const errorMsg = error instanceof Error ? error.message : '';
        if (errorMsg === 'CHANGE_ORDER_NOT_FOUND') {
            return NextResponse.json({ error: 'Change order not found' }, { status: 404 });
        }
        if (errorMsg === 'DRAFT_ONLY_DELETION') {
            return NextResponse.json({ error: 'Only DRAFT change orders can be deleted' }, { status: 400 });
        }
        return NextResponse.json({ error: 'Failed to delete change order' }, { status: 500 });
    }
}
