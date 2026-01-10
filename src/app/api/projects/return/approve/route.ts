import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
    try {
        const { returnId, approvedById } = await request.json();

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

            // 2. Process Items
            for (const item of returnReq.items) {
                if (item.condition === 'GOOD') {
                    // Add back to stock
                    await tx.inventoryStock.upsert({
                        where: { storeId_itemId: { storeId: returnReq.storeId, itemId: item.itemId } },
                        create: { storeId: returnReq.storeId, itemId: item.itemId, quantity: item.quantity },
                        update: { quantity: { increment: item.quantity } }
                    });
                } else {
                    // Decide what to do with DAMAGED? Maybe just log it. 
                    // For now, we don't add damaged items to main stock, or add to a 'Damaged' pile?
                    // User requirement implies "return to stores", usually implies good stock or tracking.
                    // I will add it to stock but maybe we need a 'condition' field in stock?
                    // InventoryStock doesn't have condition. 
                    // Let's assume ONLY GOOD items are returned to usable stock.
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

            // 3. Credit Project Total Cost
            await tx.project.update({
                where: { id: returnReq.projectId },
                data: { actualCost: { decrement: totalCredit } }
            });
        });

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}
