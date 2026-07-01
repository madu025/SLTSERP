import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
    try {
        const { returnId } = await request.json();
        const approvedById = request.headers.get('x-user-id');

        if (!approvedById) {
            return NextResponse.json({ error: 'User authentication required' }, { status: 401 });
        }

        if (!returnId) return NextResponse.json({ error: 'ID required' }, { status: 400 });

        const returnReq = await prisma.projectMaterialReturn.findUnique({
            where: { id: returnId },
            include: { items: true }
        });

        if (!returnReq || returnReq.status !== 'PENDING') {
            return NextResponse.json({ error: 'Invalid return request' }, { status: 400 });
        }

        await prisma.$transaction(async (tx) => {
            // 1. Update Status
            await tx.projectMaterialReturn.update({
                where: { id: returnId },
                data: {
                    status: 'APPROVED',
                    approvedById,
                    approvedAt: new Date()
                }
            });

            let totalCredit = 0;
            const transferInItems: { itemId: string; quantity: number }[] = [];
            const wastageItems: { itemId: string; quantity: number }[] = [];

            // 2. Process Items
            for (const item of returnReq.items) {
                if (item.condition === 'GOOD') {
                    // Add back to stock
                    await tx.inventoryStock.upsert({
                        where: { storeId_itemId: { storeId: returnReq.storeId, itemId: item.itemId } },
                        create: { storeId: returnReq.storeId, itemId: item.itemId, quantity: item.quantity },
                        update: { quantity: { increment: item.quantity } }
                    });
                    transferInItems.push({ itemId: item.itemId, quantity: item.quantity });
                } else {
                    // Log as wastage (not added back to usable stock)
                    wastageItems.push({ itemId: item.itemId, quantity: item.quantity });
                }

                // Credit Project BOQ
                const boqItem = await tx.projectBOQItem.findFirst({
                    where: { projectId: returnReq.projectId, materialId: item.itemId }
                });

                if (boqItem) {
                    const credit = item.quantity * boqItem.unitRate;
                    await tx.projectBOQItem.update({
                        where: { id: boqItem.id },
                        data: {
                            actualQuantity: { decrement: item.quantity },
                            actualCost: { decrement: credit }
                        }
                    });
                    totalCredit += credit;
                }
            }

            // Create InventoryTransaction records for tracing
            if (transferInItems.length > 0) {
                await tx.inventoryTransaction.create({
                    data: {
                        type: 'TRANSFER_IN',
                        storeId: returnReq.storeId,
                        referenceId: returnReq.id,
                        notes: `Project Return Approved (GOOD items) - Ref ${returnReq.returnNumber}`,
                        userId: approvedById,
                        items: {
                            create: transferInItems.map(i => ({
                                itemId: i.itemId,
                                quantity: i.quantity
                            }))
                        }
                    }
                });
            }

            if (wastageItems.length > 0) {
                await tx.inventoryTransaction.create({
                    data: {
                        type: 'WASTAGE',
                        storeId: returnReq.storeId,
                        referenceId: returnReq.id,
                        notes: `Project Return Approved (DAMAGED items) - Ref ${returnReq.returnNumber}`,
                        userId: approvedById,
                        items: {
                            create: wastageItems.map(i => ({
                                itemId: i.itemId,
                                quantity: i.quantity
                            }))
                        }
                    }
                });
            }

            // 3. Credit Project Total Cost and update variance
            if (returnReq.projectId) {
                const project = await tx.project.findUnique({
                    where: { id: returnReq.projectId }
                });

                if (project) {
                    const newActualCost = Math.max(0, (project.actualCost || 0) - totalCredit);
                    const newVariance = project.budget !== null && project.budget !== undefined
                        ? project.budget - newActualCost
                        : null;

                    await tx.project.update({
                        where: { id: returnReq.projectId },
                        data: {
                            actualCost: newActualCost,
                            variance: newVariance
                        }
                    });
                }
            }
        });

        return NextResponse.json({ success: true });

    } catch (error: unknown) {
        console.error(error);
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}
