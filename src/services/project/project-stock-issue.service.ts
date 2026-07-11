import { prisma } from '@/lib/prisma';
import { StockService } from '../inventory/stock.service';
import { TransactionClient } from '../inventory/types';

export class ProjectStockIssueService {
    /**
     * Create a pending stock issue request
     */
    static async createIssueRequest(data: {
        projectId: string;
        storeId: string;
        items: { itemId: string; quantity: number | string; remarks?: string }[];
        remarks?: string;
        userId: string;
        issueDate?: Date | string;
    }) {
        const { projectId, storeId, items, remarks, userId, issueDate } = data;

        // Generate Issue Number
        const count = await prisma.stockIssue.count();
        const issueNumber = `ISS-${new Date().getFullYear()}-${(count + 1).toString().padStart(4, '0')}`;

        // Verify stock availability (Preliminary check)
        for (const item of items) {
            const stock = await prisma.inventoryStock.findUnique({
                where: {
                    storeId_itemId: {
                        storeId: storeId,
                        itemId: item.itemId
                    }
                },
                include: { item: true }
            });

            if (!stock || Number(stock.quantity) < parseFloat(item.quantity.toString())) {
                throw new Error(`INSUFFICIENT_STOCK: Insufficient stock for item: ${stock?.item.name || item.itemId}`);
            }
        }

        // Fetch Project Name
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            select: { name: true }
        });
        const recipientName = project ? `Project: ${project.name}` : 'Unknown Project';

        // Create PENDING Issue
        const stockIssue = await prisma.stockIssue.create({
            data: {
                issueNumber,
                storeId,
                projectId,
                issuedById: userId,
                issueType: 'PROJECT',
                recipientName,
                remarks,
                status: 'PENDING', // Wait for Approval
                createdAt: issueDate ? new Date(issueDate) : new Date(),
                items: {
                    create: items.map((item) => ({
                        itemId: item.itemId,
                        quantity: parseFloat(item.quantity.toString()),
                        remarks: item.remarks
                    }))
                }
            }
        });

        return stockIssue;
    }

    /**
     * Get stock issue requests for a project
     */
    static async getProjectIssues(projectId: string) {
        return await prisma.stockIssue.findMany({
            where: { projectId },
            include: {
                store: { select: { name: true } },
                issuedBy: { select: { name: true } },
                items: {
                    include: {
                        item: { select: { code: true, name: true, unit: true } }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
    }

    /**
     * Approve a pending stock issue request
     */
    static async approveIssueRequest(issueId: string, approvedById: string) {
        const issue = await prisma.stockIssue.findUnique({
            where: { id: issueId },
            include: { items: true }
        });

        if (!issue) {
            throw new Error('ISSUE_NOT_FOUND');
        }

        if (issue.status !== 'PENDING') {
            throw new Error('ISSUE_NOT_PENDING');
        }

        // Verify stock availability
        for (const item of issue.items) {
            const stock = await prisma.inventoryStock.findUnique({
                where: { storeId_itemId: { storeId: issue.storeId, itemId: item.itemId } }
            });
            if (!stock || Number(stock.quantity) < item.quantity) {
                throw new Error(`INSUFFICIENT_STOCK: Insufficient stock for item ID: ${item.itemId}`);
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

        return { success: true };
    }

    /**
     * Create a project material return request
     */
    static async createReturnRequest(data: {
        projectId: string;
        storeId: string;
        items: { itemId: string; quantity: number | string; condition?: string; remarks?: string }[];
        reason?: string;
        userId: string;
    }) {
        const { projectId, storeId, items, reason, userId } = data;

        const count = await prisma.projectMaterialReturn.count();
        const returnNumber = `PMRN-${new Date().getFullYear()}-${(count + 1).toString().padStart(4, '0')}`;

        const returnReq = await prisma.projectMaterialReturn.create({
            data: {
                returnNumber,
                projectId,
                storeId,
                returnedById: userId,
                reason,
                status: 'PENDING',
                items: {
                    create: items.map((item) => ({
                        itemId: item.itemId,
                        quantity: parseFloat(item.quantity.toString()),
                        condition: item.condition || 'GOOD',
                        remarks: item.remarks
                    }))
                }
            }
        });

        return returnReq;
    }

    /**
     * List returns for a project
     */
    static async getProjectReturns(projectId: string) {
        return await prisma.projectMaterialReturn.findMany({
            where: { projectId },
            include: {
                store: { select: { name: true } },
                items: { include: { item: { select: { code: true, name: true, unit: true } } } },
                returnedBy: { select: { name: true } },
                approvedBy: { select: { name: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
    }

    /**
     * Approve a project material return request
     */
    static async approveReturnRequest(returnId: string, approvedById: string) {
        const returnReq = await prisma.projectMaterialReturn.findUnique({
            where: { id: returnId },
            include: { items: true }
        });

        if (!returnReq || returnReq.status !== 'PENDING') {
            throw new Error('INVALID_RETURN_REQUEST');
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

        return { success: true };
    }
}
