import { prisma } from '@/lib/prisma';
import { Prisma, InventoryBatchStock, ContractorBatchStock, StockIssue } from '@prisma/client';
import { TransactionClient, PickedBatch } from './types';

export class StockService {
    // Round to 4 decimal places to prevent floating point issues
    static round(val: number): number {
        return Math.round(val * 10000) / 10000;
    }

    static async getStock(storeId: string) {
        if (!storeId) throw new Error('STORE_ID_REQUIRED');

        return await prisma.inventoryStock.findMany({
            where: { storeId },
            include: {
                item: true
            },
            orderBy: { item: { code: 'asc' } }
        });
    }

    static async getStoreBatches(storeId: string, itemId?: string): Promise<InventoryBatchStock[]> {
        return await (prisma as TransactionClient).inventoryBatchStock.findMany({
            where: {
                storeId,
                ...(itemId ? { itemId } : {})
            },
            include: {
                batch: {
                    include: {
                        grn: { select: { grnNumber: true, createdAt: true } }
                    }
                },
                item: true
            },
            orderBy: { batch: { createdAt: 'desc' } }
        });
    }

    static async getContractorBatches(contractorId: string, itemId?: string): Promise<ContractorBatchStock[]> {
        return await (prisma as TransactionClient).contractorBatchStock.findMany({
            where: {
                contractorId,
                ...(itemId ? { itemId } : {})
            },
            include: {
                batch: {
                    include: {
                        grn: { select: { grnNumber: true, createdAt: true } }
                    }
                },
                item: true
            },
            orderBy: { batch: { createdAt: 'desc' } }
        });
    }

    /**
     * Pick batches from a store based on FIFO
     */
    static async pickStoreBatchesFIFO(tx: TransactionClient, storeId: string, itemId: string, requiredQty: number): Promise<PickedBatch[]> {
        const qtyToPick = this.round(requiredQty);

        // LOCKING: Prevent concurrent modifications to the same item's batches in this store
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (tx as any).$executeRaw`SELECT * FROM "InventoryBatchStock" WHERE "storeId" = ${storeId} AND "itemId" = ${itemId} FOR UPDATE`;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const batches = await (tx as any).inventoryBatchStock.findMany({
            where: { storeId, itemId, quantity: { gt: 0 } },
            include: { batch: true },
            orderBy: { batch: { createdAt: 'asc' } }
        });

        const pickedBatches: PickedBatch[] = [];
        let remainingToPick = qtyToPick;

        for (const stock of batches) {
            if (remainingToPick <= 0) break;
            const available = this.round(stock.quantity);
            const take = Math.min(available, remainingToPick);
            pickedBatches.push({
                batchId: stock.batchId,
                quantity: this.round(take),
                batch: stock.batch
            });
            remainingToPick = this.round(remainingToPick - take);
        }

        if (this.round(remainingToPick) > 0) {
            throw new Error(`INSUFFICIENT_BATCH_STOCK_FOR_ITEM_${itemId}: Missing ${remainingToPick}`);
        }

        return pickedBatches;
    }

    /**
     * Pick batches from a contractor based on FIFO with locking
     */
    static async pickContractorBatchesFIFO(tx: TransactionClient, contractorId: string, itemId: string, requiredQty: number): Promise<PickedBatch[]> {
        const qtyToPick = this.round(requiredQty);

        // LOCKING: Prevent concurrent modifications to the same contractor item stock
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (tx as any).$executeRaw`SELECT * FROM "ContractorBatchStock" WHERE "contractorId" = ${contractorId} AND "itemId" = ${itemId} FOR UPDATE`;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const batches = await (tx as any).contractorBatchStock.findMany({
            where: { contractorId, itemId, quantity: { gt: 0 } },
            include: { batch: true },
            orderBy: { batch: { createdAt: 'asc' } }
        });

        const pickedBatches: PickedBatch[] = [];
        let remainingToPick = qtyToPick;

        for (const stock of batches) {
            if (remainingToPick <= 0) break;
            const available = this.round(stock.quantity);
            const take = Math.min(available, remainingToPick);
            pickedBatches.push({
                batchId: stock.batchId,
                quantity: this.round(take),
                batch: stock.batch
            });
            remainingToPick = this.round(remainingToPick - take);
        }

        if (this.round(remainingToPick) > 0) {
            throw new Error(`INSUFFICIENT_CONTRACTOR_BATCH_STOCK_FOR_ITEM_${itemId}: Missing ${remainingToPick}`);
        }

        return pickedBatches;
    }

    /**
     * Initialize or Adjust Stock Levels in Bulk
     */
    static async initializeStock(storeId: string, items: { itemId: string; quantity: string | number }[], reason?: string, userId?: string) {
        if (!storeId || !Array.isArray(items)) throw new Error('INVALID_PAYLOAD');

        return await prisma.$transaction(async (tx: TransactionClient) => {
            const transactionItems: { itemId: string; quantity: number; beforeQty: number; afterQty: number }[] = [];

            for (const item of items) {
                const newQty = this.round(parseFloat(item.quantity.toString()));
                if (isNaN(newQty)) continue;

                // Get current stock
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const currentStock = await (tx as any).inventoryStock.findUnique({
                    where: { storeId_itemId: { storeId, itemId: item.itemId } }
                });

                const oldQty = currentStock ? this.round(currentStock.quantity) : 0;
                const diff = this.round(newQty - oldQty);

                if (diff === 0) continue; // No change

                // A. BATCH HANDLING
                if (diff > 0) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const itemData = await (tx as any).inventoryItem.findUnique({
                        where: { id: item.itemId },
                        select: { costPrice: true, unitPrice: true }
                    });

                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const batch = await (tx as any).inventoryBatch.create({
                        data: {
                            batchNumber: `ADJ-${Date.now()}`,
                            itemId: item.itemId,
                            initialQty: diff,
                            costPrice: itemData?.costPrice || 0,
                            unitPrice: itemData?.unitPrice || 0
                        }
                    });

                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    await (tx as any).inventoryBatchStock.create({
                        data: {
                            storeId,
                            batchId: batch.id,
                            itemId: item.itemId,
                            quantity: diff
                        }
                    });
                } else {
                    const reduceQty = Math.abs(diff);
                    const pickedBatches = await this.pickStoreBatchesFIFO(tx, storeId, item.itemId, reduceQty);

                    for (const picked of pickedBatches) {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        await (tx as any).inventoryBatchStock.update({
                            where: { storeId_batchId: { storeId, batchId: picked.batchId } },
                            data: { quantity: { decrement: picked.quantity } }
                        });
                    }
                }

                // B. UPDATE GLOBAL STOCK
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await (tx as any).inventoryStock.upsert({
                    where: { storeId_itemId: { storeId, itemId: item.itemId } },
                    update: { quantity: newQty },
                    create: { storeId, itemId: item.itemId, quantity: newQty }
                });

                transactionItems.push({
                    itemId: item.itemId,
                    quantity: diff,
                    beforeQty: oldQty,
                    afterQty: newQty
                });
            }

            if (transactionItems.length > 0) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await (tx as any).inventoryTransaction.create({
                    data: {
                        type: 'ADJUSTMENT',
                        storeId,
                        userId: userId || 'SYSTEM',
                        referenceId: `INIT-STOCK-${Date.now()}`,
                        notes: reason || 'Initial Stock Setup',
                        items: {
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            create: transactionItems.map((ti: any) => ({
                                itemId: ti.itemId,
                                quantity: ti.quantity
                            }))
                        }
                    }
                });
            }

            return transactionItems.length;
        });
    }

    static async createStockIssue(data: {
        storeId: string;
        issuedById: string;
        issueType: string;
        projectId?: string;
        contractorId?: string;
        teamId?: string;
        recipientName: string;
        remarks?: string;
        items: { itemId: string; quantity: string | number; remarks?: string }[];
    }) {
        const { storeId, issuedById, issueType, projectId, contractorId, teamId, recipientName, remarks, items } = data;

        if (!storeId || !issuedById || !recipientName || !items || items.length === 0) {
            throw new Error('MISSING_FIELDS');
        }

        return await prisma.$transaction(async (tx: TransactionClient) => {
            const issueNumber = `ISS-${Date.now()}`;

            for (const item of items) {
                const quantity = parseFloat(item.quantity.toString());

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const existingStock = await (tx as any).inventoryStock.findUnique({
                    where: {
                        storeId_itemId: { storeId, itemId: item.itemId }
                    }
                });

                if (!existingStock || existingStock.quantity < quantity) {
                    throw new Error(`INSUFFICIENT_STOCK: ${item.itemId}`);
                }

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await (tx as any).inventoryStock.update({
                    where: {
                        storeId_itemId: { storeId, itemId: item.itemId }
                    },
                    data: { quantity: { decrement: quantity } }
                });

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const invTx = await (tx as any).inventoryTransaction.create({
                    data: {
                        type: 'TRANSFER_OUT',
                        storeId,
                        userId: issuedById,
                        referenceId: issueNumber,
                        notes: `Issued to ${recipientName} - ${issueType}`
                    }
                });

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await (tx as any).inventoryTransactionItem.create({
                    data: {
                        transactionId: invTx.id,
                        itemId: item.itemId,
                        quantity: -quantity
                    }
                });
            }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const issue = await (tx as any).stockIssue.create({
                data: {
                    issueNumber,
                    storeId,
                    issuedById,
                    issueType,
                    projectId: projectId || null,
                    contractorId: contractorId || null,
                    teamId: teamId || null,
                    recipientName,
                    remarks: remarks || null,
                    items: {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        create: items.map((item: any) => ({
                            itemId: item.itemId,
                            quantity: parseFloat(item.quantity.toString()),
                            remarks: item.remarks || null
                        }))
                    }
                },
                include: { items: true }
            });

            return issue;
        });
    }

    static async getStockIssues(filters: {
        storeId?: string;
        issueType?: string;
    }): Promise<StockIssue[]> {
        const where: Prisma.StockIssueWhereInput = {};
        if (filters.storeId && filters.storeId !== 'unassigned') where.storeId = filters.storeId;
        if (filters.issueType) where.issueType = filters.issueType;

        return await prisma.stockIssue.findMany({
            where,
            include: {
                items: { include: { item: true } },
                issuedBy: { select: { id: true, name: true } },
                project: { select: { id: true, name: true } },
                contractor: { select: { id: true, name: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
    }
}
