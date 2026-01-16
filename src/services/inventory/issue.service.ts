import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { StockService } from './stock.service';
import { StoreService } from './store.service';
import { emitSystemEvent } from '@/lib/events';
import { TransactionClient } from './types';

export class IssueService {
    static async getMaterialIssues(contractorId: string, month?: string) {
        const whereClause: Prisma.ContractorMaterialIssueWhereInput = { contractorId };
        if (month) whereClause.month = month;

        return await prisma.contractorMaterialIssue.findMany({
            where: whereClause,
            include: {
                store: { select: { name: true } },
                items: {
                    include: {
                        item: { select: { name: true, code: true } }
                    }
                }
            },
            orderBy: { issueDate: 'desc' }
        });
    }

    static async issueMaterial(data: {
        contractorId: string;
        storeId: string;
        month: string;
        items: { itemId: string; quantity: string | number; unit?: string }[];
        userId?: string;
    }) {
        const { contractorId, storeId, month, items, userId } = data;

        const result = await prisma.$transaction(async (tx: TransactionClient) => {
            // 1. Create Material Issue
            const materialIssue = await tx.contractorMaterialIssue.create({
                data: {
                    contractorId,
                    storeId,
                    month,
                    issueDate: new Date(),
                    issuedBy: userId || 'SYSTEM',
                    items: {
                        create: items.map((i) => ({
                            itemId: i.itemId,
                            quantity: parseFloat(i.quantity.toString()),
                            unit: i.unit || 'Nos'
                        }))
                    }
                }
            });

            // 2. FIFO Stock Deduction & Batch Transfer
            const transactionItems = [];

            for (const item of items) {
                const qty = StockService.round(parseFloat(item.quantity.toString()));
                if (qty <= 0) continue;

                // A. Pick Batches using FIFO
                const pickedBatches = await StockService.pickStoreBatchesFIFO(tx, storeId, item.itemId, qty);

                for (const picked of pickedBatches) {
                    // Reduce from Store Batch Stock
                    await tx.inventoryBatchStock.update({
                        where: { storeId_batchId: { storeId, batchId: picked.batchId } },
                        data: { quantity: { decrement: picked.quantity } }
                    });

                    // Add to Contractor Batch Stock
                    await tx.contractorBatchStock.upsert({
                        where: { contractorId_batchId: { contractorId, batchId: picked.batchId } },
                        update: { quantity: { increment: picked.quantity } },
                        create: {
                            contractorId,
                            batchId: picked.batchId,
                            itemId: item.itemId,
                            quantity: picked.quantity
                        }
                    });

                    // C. Log EACH Batch Movement
                    transactionItems.push({
                        itemId: item.itemId,
                        batchId: picked.batchId,
                        quantity: -picked.quantity
                    });
                }

                // D. Update Global Store Stock
                await tx.inventoryStock.update({
                    where: { storeId_itemId: { storeId, itemId: item.itemId } },
                    data: { quantity: { decrement: qty } }
                });

                // E. Update Contractor Total Stock
                await tx.contractorStock.upsert({
                    where: { contractorId_itemId: { contractorId, itemId: item.itemId } },
                    update: { quantity: { increment: qty } },
                    create: { contractorId, itemId: item.itemId, quantity: qty }
                });
            }

            // 3. Create Transaction Log
            await tx.inventoryTransaction.create({
                data: {
                    type: 'MATERIAL_ISSUE',
                    storeId,
                    referenceId: materialIssue.id,
                    userId: userId || 'SYSTEM',
                    notes: `Material issued to contractor ${contractorId} (FIFO Batched)`,
                    items: {
                        create: transactionItems.map((ti) => ({
                            itemId: ti.itemId,
                            batchId: ti.batchId,
                            quantity: ti.quantity
                        }))
                    }
                }
            });

            return materialIssue;
        });

        // Trigger Low Stock Alerts (non-blocking)
        try {
            for (const item of items) {
                StoreService.checkLowStock(storeId, item.itemId);
            }
        } catch (e) {
            console.error("Low stock check failed:", e);
        }

        emitSystemEvent('INVENTORY_UPDATE');
        return result;
    }

    static async createMaterialReturn(data: {
        contractorId: string;
        storeId: string;
        month: string;
        reason?: string;
        items: { itemId: string; quantity: string | number; unit?: string; condition?: string }[];
        userId: string;
    }) {
        const { contractorId, storeId, month, reason, items, userId } = data;

        if (!contractorId || !storeId || !month || !items || !Array.isArray(items) || items.length === 0) {
            throw new Error('MISSING_FIELDS');
        }

        return await prisma.$transaction(async (tx: TransactionClient) => {
            // 1. Create Return Record
            const returnRecord = await tx.contractorMaterialReturn.create({
                data: {
                    contractorId,
                    storeId,
                    month,
                    reason,
                    status: 'ACCEPTED',
                    acceptedBy: userId,
                    acceptedAt: new Date(),
                    items: {
                        create: items.map((item) => ({
                            itemId: item.itemId,
                            quantity: parseFloat(item.quantity.toString()),
                            unit: item.unit || 'Nos',
                            condition: item.condition || 'GOOD'
                        }))
                    }
                }
            });

            // 2. FIFO Stock Deduction from Contractor & Add to Store
            for (const item of items) {
                const qty = StockService.round(parseFloat(item.quantity.toString()));
                if (qty <= 0) continue;

                // A. FIFO Deduction from Contractor
                const pickedBatches = await StockService.pickContractorBatchesFIFO(tx, contractorId, item.itemId, qty);

                for (const picked of pickedBatches) {
                    await tx.contractorBatchStock.update({
                        where: { contractorId_batchId: { contractorId, batchId: picked.batchId } },
                        data: { quantity: { decrement: picked.quantity } }
                    });

                    if (item.condition === 'GOOD') {
                        await tx.inventoryBatchStock.upsert({
                            where: { storeId_batchId: { storeId, batchId: picked.batchId } },
                            update: { quantity: { increment: picked.quantity } },
                            create: {
                                storeId,
                                batchId: picked.batchId,
                                itemId: item.itemId,
                                quantity: picked.quantity
                            }
                        });
                    }
                }

                await tx.contractorStock.update({
                    where: { contractorId_itemId: { contractorId, itemId: item.itemId } },
                    data: { quantity: { decrement: qty } }
                });

                if (item.condition === 'GOOD') {
                    await tx.inventoryStock.upsert({
                        where: { storeId_itemId: { storeId, itemId: item.itemId } },
                        update: { quantity: { increment: qty } },
                        create: { storeId, itemId: item.itemId, quantity: qty }
                    });
                }

                await tx.inventoryTransaction.create({
                    data: {
                        type: 'RETURN',
                        storeId,
                        referenceId: returnRecord.id,
                        userId: userId || 'SYSTEM',
                        notes: `Returned from contractor ${contractorId}: ${item.condition}`,
                        items: {
                            create: [{
                                itemId: item.itemId,
                                quantity: item.condition === 'GOOD' ? qty : 0
                            }]
                        }
                    }
                });
            }

            return returnRecord;
        });
    }

    static async getMaterialReturns(filters: {
        contractorId?: string;
        storeId?: string;
        month?: string;
    }) {
        const whereClause: Prisma.ContractorMaterialReturnWhereInput = {};
        if (filters.contractorId) whereClause.contractorId = filters.contractorId;
        if (filters.storeId) whereClause.storeId = filters.storeId;
        if (filters.month) whereClause.month = filters.month;

        return await prisma.contractorMaterialReturn.findMany({
            where: whereClause,
            include: {
                store: { select: { name: true } },
                contractor: { select: { name: true } },
                items: {
                    include: {
                        item: { select: { name: true, code: true } }
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
    }
}
