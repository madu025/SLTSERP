import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/projects/purchase-orders?projectId=xxx - List POs by project
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get('projectId');

        if (!projectId) {
            return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
        }

        const purchaseOrders = await prisma.projectPurchaseOrder.findMany({
            where: { projectId },
            include: {
                items: true,
                requisition: {
                    select: { prNumber: true, title: true }
                },
                goodsReceipts: {
                    include: { items: true }
                }
            },
            orderBy: { createdAt: 'desc' },
        });

        return NextResponse.json(purchaseOrders);
    } catch (error: any) {
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
            requisitionId,
            vendorId,
            vendorName,
            title,
            description,
            priority,
            type,
            expectedDelivery,
            deliveryLocation,
            items,
            paymentTerms,
            deliveryTerms,
            notes,
        } = body;

        // Validate required fields
        if (!projectId || !vendorId || !title || !items?.length) {
            return NextResponse.json(
                { error: 'projectId, vendorId, title, and items are required' },
                { status: 400 }
            );
        }

        // Verify project exists
        const project = await prisma.project.findUnique({ where: { id: projectId } });
        if (!project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        // Auto-generate PO number
        const lastPO = await prisma.projectPurchaseOrder.findFirst({
            orderBy: { poNumber: 'desc' },
            select: { poNumber: true },
        });

        let nextPONumber: string;
        if (lastPO && lastPO.poNumber) {
            const lastNum = parseInt(lastPO.poNumber.replace('PO-', ''), 10);
            const nextNum = isNaN(lastNum) ? 1 : lastNum + 1;
            nextPONumber = 'PO-' + String(nextNum).padStart(5, '0');
        } else {
            nextPONumber = 'PO-00001';
        }

        // Calculate totals from items
        let subtotal = 0;
        const itemsData = items.map((item: any) => {
            const totalPrice = (item.unitPrice || 0) * (item.quantity || 0);
            subtotal += totalPrice;
            return {
                requisitionItemId: item.requisitionItemId || null,
                itemCode: item.itemCode,
                description: item.description,
                unit: item.unit || 'NOS',
                quantity: item.quantity || 0,
                unitPrice: item.unitPrice || 0,
                totalPrice,
                receivedQty: 0,
                balanceQty: item.quantity || 0,
                deliveryDate: item.deliveryDate ? new Date(item.deliveryDate) : null,
                notes: item.notes || null,
            };
        });

        // Use transaction to create PO + items
        const purchaseOrder = await prisma.$transaction(async (tx) => {
            const newPO = await tx.projectPurchaseOrder.create({
                data: {
                    poNumber: nextPONumber,
                    projectId,
                    requisitionId: requisitionId || null,
                    vendorId,
                    vendorName: vendorName || '',
                    title,
                    description: description || null,
                    priority: priority || 'MEDIUM',
                    type: type || 'MATERIAL',
                    expectedDelivery: expectedDelivery ? new Date(expectedDelivery) : null,
                    deliveryLocation: deliveryLocation || null,
                    subtotal,
                    taxAmount: 0,
                    discountAmount: 0,
                    totalAmount: subtotal,
                    paymentTerms: paymentTerms || null,
                    deliveryTerms: deliveryTerms || null,
                    notes: notes || null,
                    items: { create: itemsData },
                },
                include: { items: true },
            });
            return newPO;
        });

        return NextResponse.json(purchaseOrder, { status: 201 });
    } catch (error: any) {
        console.error('Error creating purchase order:', error);
        if (error.code === 'P2002') {
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

        const existing = await prisma.projectPurchaseOrder.findUnique({ where: { id } });
        if (!existing) {
            return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
        }

        const updateData: any = { status };

        switch (status) {
            case 'APPROVED':
                if (!approvedById) {
                    return NextResponse.json({ error: 'approvedById is required' }, { status: 400 });
                }
                updateData.approvedById = approvedById;
                updateData.approvedAt = new Date();
                break;
            case 'ISSUED':
                if (!issuedById) {
                    return NextResponse.json({ error: 'issuedById is required' }, { status: 400 });
                }
                updateData.issuedById = issuedById;
                updateData.issuedAt = new Date();
                break;
            case 'CLOSED':
                if (!closedById) {
                    return NextResponse.json({ error: 'closedById is required' }, { status: 400 });
                }
                updateData.closedById = closedById;
                updateData.closedAt = new Date();
                break;
            case 'CANCELLED':
                updateData.cancellationReason = cancellationReason || null;
                break;
            default:
                break;
        }

        const purchaseOrder = await prisma.projectPurchaseOrder.update({
            where: { id },
            data: updateData,
            include: { items: true },
        });

        return NextResponse.json(purchaseOrder);
    } catch (error: any) {
        console.error('Error updating purchase order:', error);
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

        const existing = await prisma.projectPurchaseOrder.findUnique({ where: { id } });
        if (!existing) {
            return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
        }

        if (existing.status !== 'DRAFT') {
            return NextResponse.json(
                { error: 'Only DRAFT purchase orders can be deleted' },
                { status: 400 }
            );
        }

        await prisma.projectPurchaseOrder.delete({ where: { id } });
        return NextResponse.json({ message: 'Purchase order deleted successfully' });
    } catch (error: any) {
        console.error('Error deleting purchase order:', error);
        return NextResponse.json({ error: 'Failed to delete purchase order' }, { status: 500 });
    }
}
