import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { StockService } from '@/services/inventory/stock.service';
import { TransactionClient } from '@/services/inventory/types';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { issueId } = body;
        
        // Extract authenticated User ID from middleware headers ONLY (no body bypass)
        const approvedById = request.headers.get('x-user-id');

        if (!approvedById) {
            return NextResponse.json({ error: 'User authentication required' }, { status: 401 });
        }

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

        for (const item of issue.items) {
            const stock = await prisma.inventoryStock.findUnique({
                where: { storeId_itemId: { storeId: issue.storeId, itemId: item.itemId } }
            });
            if (!stock || Number(stock.quantity) < item.quantity) {
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
                    approvedById: approvedById,
                    approvedAt: new Date()
                }
            });

            let totalIssueCost = 0;
            const transactionItems: { itemId: string; batchId: string; quantity: number }[] = [];

            // 2. Process Items
            for (const item of issue.items) {
                // Deduct Batch Stock using FIFO
                const pickedBatches = await StockService.pickStoreBatchesFIFO(
                    tx as TransactionClient,
                    issue.storeId,
                    item.itemId,
                    item.quantity
                );

                for (const picked of pickedBatches) {
                    await tx.inventoryBatchStock.update({
                        where: {
                            storeId_batchId: {
                                storeId: issue.storeId,
                                batchId: picked.batchId!
                            }
                        },
                        data: { quantity: { decrement: picked.quantity } }
                    });

                    transactionItems.push({
                        itemId: item.itemId,
                        batchId: picked.batchId!,
                        quantity: -picked.quantity
                    });
                }

                // Deduct Summary Stock
                await tx.inventoryStock.update({
                    where: { storeId_itemId: { storeId: issue.storeId, itemId: item.itemId } },
                    data: { quantity: { decrement: item.quantity } }
                });

                // Update BOQ Actuals - Only if this is a project issue
                if (issue.projectId) {
                    const boqItem = await tx.projectBOQItem.findFirst({
                        where: {
                            projectId: issue.projectId,
                            materialId: item.itemId
                        }
                    });

                    if (boqItem) {
                        const cost = item.quantity * boqItem.unitRate;
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
            }

            // Create InventoryTransaction for tracking
            if (transactionItems.length > 0) {
                await tx.inventoryTransaction.create({
                    data: {
                        type: 'TRANSFER_OUT',
                        storeId: issue.storeId,
                        referenceId: issue.id,
                        notes: `Project Stock Issue Approved - Ref ${issue.issueNumber}`,
                        userId: approvedById,
                        items: {
                            create: transactionItems.map(i => ({
                                itemId: i.itemId,
                                batchId: i.batchId,
                                quantity: i.quantity
                            }))
                        }
                    }
                });
            }

            // 3. Update Project Cost - Only if this is a project issue
            if (issue.projectId) {
                const project = await tx.project.findUnique({
                    where: { id: issue.projectId }
                });
                
                if (project) {
                    const newActualCost = (project.actualCost || 0) + totalIssueCost;
                    const newVariance = project.budget !== null && project.budget !== undefined
                        ? project.budget - newActualCost
                        : null;

                    await tx.project.update({
                        where: { id: issue.projectId },
                        data: {
                            actualCost: newActualCost,
                            variance: newVariance
                        }
                    });
                }
            }
        });

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Error approving issue:', error);
        return NextResponse.json({ error: 'Failed to approve' }, { status: 500 });
    }
}
