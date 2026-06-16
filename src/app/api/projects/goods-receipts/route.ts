import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/projects/goods-receipts?projectId=xxx - List GRs by project
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get('projectId');
        const poId = searchParams.get('poId');

        if (!projectId && !poId) {
            return NextResponse.json({ error: 'projectId or poId is required' }, { status: 400 });
        }

        const where: any = {};
        if (projectId) where.projectId = projectId;
        if (poId) where.poId = poId;

        const goodsReceipts = await prisma.projectGoodsReceipt.findMany({
            where,
            include: {
                items: true,
                purchaseOrder: {
                    select: { poNumber: true, title: true, vendorName: true }
                }
            },
            orderBy: { receivedDate: 'desc' },
        });

        return NextResponse.json(goodsReceipts);
    } catch (error: any) {
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
            receivedDate,
            deliveryNoteRef,
            invoiceRef,
            remarks,
            storeId,
            items,
        } = body;

        // Validate required fields
        if (!poId || !projectId || !receivedById || !items?.length) {
            return NextResponse.json(
                { error: 'poId, projectId, receivedById, and items are required' },
                { status: 400 }
            );
        }

        // Verify PO exists
        const po = await prisma.projectPurchaseOrder.findUnique({
            where: { id: poId },
            include: { items: true }
        });
        if (!po) {
            return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
        }

        // Auto-generate GRN number
        const lastGRN = await prisma.projectGoodsReceipt.findFirst({
            orderBy: { grnNumber: 'desc' },
            select: { grnNumber: true },
        });

        let nextGRNNumber: string;
        if (lastGRN && lastGRN.grnNumber) {
            const lastNum = parseInt(lastGRN.grnNumber.replace('GRN-', ''), 10);
            const nextNum = isNaN(lastNum) ? 1 : lastNum + 1;
            nextGRNNumber = 'GRN-' + String(nextNum).padStart(5, '0');
        } else {
            nextGRNNumber = 'GRN-00001';
        }

        // Use transaction to create GR + update PO item quantities
        const goodsReceipt = await prisma.$transaction(async (tx) => {
            const newGR = await tx.projectGoodsReceipt.create({
                data: {
                    grnNumber: nextGRNNumber,
                    poId,
                    projectId,
                    receivedById,
                    receivedDate: receivedDate ? new Date(receivedDate) : new Date(),
                    deliveryNoteRef: deliveryNoteRef || null,
                    invoiceRef: invoiceRef || null,
                    remarks: remarks || null,
                    storeId: storeId || null,
                    items: {
                        create: items.map((item: any) => ({
                            poItemId: item.poItemId,
                            itemCode: item.itemCode,
                            description: item.description,
                            unit: item.unit || 'NOS',
                            quantityOrdered: item.quantityOrdered || 0,
                            quantityReceived: item.quantityReceived || 0,
                            quantityAccepted: item.quantityAccepted || item.quantityReceived || 0,
                            quantityRejected: item.quantityRejected || 0,
                            rejectionReason: item.rejectionReason || null,
                            unitPrice: item.unitPrice || 0,
                            totalPrice: (item.unitPrice || 0) * (item.quantityReceived || 0),
                            batchNumber: item.batchNumber || null,
                            serialNumbers: item.serialNumbers || [],
                            notes: item.notes || null,
                        })),
                    },
                },
                include: { items: true },
            });

            // Update PO item received/balance quantities
            for (const item of items) {
                if (item.poItemId) {
                    const poItem = await tx.projectPurchaseOrderItem.findUnique({
                        where: { id: item.poItemId }
                    });
                    if (poItem) {
                        const newReceived = (poItem.receivedQty || 0) + (item.quantityReceived || 0);
                        const newBalance = (poItem.balanceQty || 0) - (item.quantityReceived || 0);
                        await tx.projectPurchaseOrderItem.update({
                            where: { id: item.poItemId },
                            data: {
                                receivedQty: newReceived,
                                balanceQty: Math.max(0, newBalance),
                            },
                        });
                    }
                }
            }

            // Update PO status if all items fully received
            const poItems = await tx.projectPurchaseOrderItem.findMany({
                where: { poId }
            });
            const allReceived = poItems.every(pi => (pi.balanceQty || 0) <= 0);
            if (allReceived) {
                await tx.projectPurchaseOrder.update({
                    where: { id: poId },
                    data: { status: 'FULLY_RECEIVED' },
                });
            } else {
                const anyReceived = poItems.some(pi => (pi.receivedQty || 0) > 0);
                if (anyReceived) {
                    await tx.projectPurchaseOrder.update({
                        where: { id: poId },
                        data: { status: 'PARTIALLY_RECEIVED' },
                    });
                }
            }

            return newGR;
        });

        return NextResponse.json(goodsReceipt, { status: 201 });
    } catch (error: any) {
        console.error('Error creating goods receipt:', error);
        if (error.code === 'P2002') {
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

        const validStatuses = ['PENDING', 'APPROVED', 'REJECTED'];
        if (!validStatuses.includes(status)) {
            return NextResponse.json({ error: `Invalid status: ${status}` }, { status: 400 });
        }

        const updateData: any = { status };
        if (status === 'APPROVED' && approvedById) {
            updateData.approvedById = approvedById;
            updateData.approvedAt = new Date();
        }

        const goodsReceipt = await prisma.projectGoodsReceipt.update({
            where: { id },
            data: updateData,
            include: { items: true },
        });

        return NextResponse.json(goodsReceipt);
    } catch (error: any) {
        console.error('Error updating goods receipt:', error);
        return NextResponse.json({ error: 'Failed to update goods receipt' }, { status: 500 });
    }
}
