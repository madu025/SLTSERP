import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { issueId, approvedById } = body; // approvedById would come from session in real app

        if (!issueId) {
            return NextResponse.json({ error: 'Issue ID required' }, { status: 400 });
        }

        const issue = await prisma.stockIssue.findUnique({
            where: { id: issueId },
            include: { items: true }
        });

        if (!issue) {
            return NextResponse.json({ error: 'Issue not found' }, { status: 404 });
        }

        if (issue.status !== 'PENDING') {
            return NextResponse.json({ error: 'Issue is not in PENDING state' }, { status: 400 });
        }

        // Verify Stock Levels Again
        for (const item of issue.items) {
            const stock = await prisma.inventoryStock.findUnique({
                where: { storeId_itemId: { storeId: issue.storeId, itemId: item.itemId } }
            });
            if (!stock || stock.quantity < item.quantity) {
                return NextResponse.json({ error: `Insufficient stock for item ID: ${item.itemId}` }, { status: 400 });
            }
        }

        // Execute Transaction
        await prisma.$transaction(async (tx) => {
            // 1. Update Issue Status
            await tx.stockIssue.update({
                where: { id: issueId },
                data: {
                    status: 'APPROVED',
                    approvedById: approvedById, // In real app, from session
                    approvedAt: new Date()
                }
            });

            let totalIssueCost = 0;

            // 2. Process Items
            for (const item of issue.items) {
                // Deduct Stock
                await tx.inventoryStock.update({
                    where: { storeId_itemId: { storeId: issue.storeId, itemId: item.itemId } },
                    data: { quantity: { decrement: item.quantity } }
                });

                // Update BOQ Actuals
                // @ts-ignore
                const boqItem = await tx.projectBOQItem.findFirst({
                    where: { projectId: issue.projectId, materialId: item.itemId }
                });

                if (boqItem) {
                    const cost = item.quantity * boqItem.unitRate;
                    // @ts-ignore
                    await tx.projectBOQItem.update({
                        where: { id: boqItem.id },
                        data: {
                            actualQuantity: { increment: item.quantity },
                            actualCost: { increment: cost }
                        }
                    });
                    totalIssueCost += cost;
                }
            }

            // 3. Update Project Cost
            await tx.project.update({
                where: { id: issue.projectId },
                data: { actualCost: { increment: totalIssueCost } }
            });
        });

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Error approving issue:', error);
        return NextResponse.json({ error: 'Failed to approve' }, { status: 500 });
    }
}
