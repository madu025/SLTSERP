/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from '@/lib/prisma';
import { Prisma, InventoryBatchStock, ContractorBatchStock, StockIssue } from '@prisma/client';
import { TransactionClient, PickedBatch } from './types';
import { InventoryRepository } from '@/repositories/inventory.repository';
import { ContractorRepository } from '@/repositories/contractor.repository';

export class StockService {
    // Round to 4 decimal places to prevent floating point issues
    static round(val: number): number {
        return Math.round(val * 10000) / 10000;
    }

    static async getStock(storeId: string) {
        if (!storeId) throw new Error('STORE_ID_REQUIRED');

        const whereClause = storeId === 'all' ? {} : { storeId };

        return await InventoryRepository.findManyStocks(
            whereClause,
            { item: true }
        );
    }

    static async getStoreBatches(storeId: string, itemId?: string): Promise<InventoryBatchStock[]> {
        return await InventoryRepository.getStoreBatches(
            {
                storeId,
                ...(itemId ? { itemId } : {})
            },
            {
                batch: {
                    include: {
                        grn: { select: { grnNumber: true, createdAt: true } }
                    }
                },
                item: true
            }
        ) as InventoryBatchStock[];
    }

    static async getContractorBatches(contractorId: string, itemId?: string): Promise<ContractorBatchStock[]> {
        return await InventoryRepository.getContractorBatches(
            {
                contractorId,
                ...(itemId ? { itemId } : {})
            },
            {
                batch: {
                    include: {
                        grn: { select: { grnNumber: true, createdAt: true } }
                    }
                },
                item: true
            }
        ) as ContractorBatchStock[];
    }

    /**
     * Pick batches from a store based on FIFO
     */
    static async pickStoreBatchesFIFO(tx: TransactionClient, storeId: string, itemId: string, requiredQty: number, allowShortage: boolean = false): Promise<PickedBatch[]> {
        const qtyToPick = this.round(requiredQty);
        const batches = await InventoryRepository.findAvailableBatches(storeId, itemId, tx as any);

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
            if (allowShortage) {
                pickedBatches.push({
                    batchId: null,
                    quantity: this.round(remainingToPick),
                    batch: { unitPrice: 0, costPrice: 0 } as any
                });
            } else {
                throw new Error(`INSUFFICIENT_BATCH_STOCK_FOR_ITEM_${itemId}: Missing ${remainingToPick}`);
            }
        }

        return pickedBatches;
    }

    /**
     * Pick batches from pre-fetched available store batches list in-memory using FIFO
     */
    static pickStoreBatchesFIFOBulk(availableBatches: any[], itemId: string, requiredQty: number, allowShortage: boolean = false): PickedBatch[] {
        const qtyToPick = this.round(requiredQty);
        // Filter batches for this itemId in memory
        const itemBatches = availableBatches.filter(b => b.itemId === itemId);

        const pickedBatches: PickedBatch[] = [];
        let remainingToPick = qtyToPick;

        for (const stock of itemBatches) {
            if (remainingToPick <= 0) break;
            const available = this.round(stock.quantity);
            const take = Math.min(available, remainingToPick);
            pickedBatches.push({
                batchId: stock.batchId,
                quantity: this.round(take),
                batch: stock.batch
            });
            remainingToPick = this.round(remainingToPick - take);
            // Reflect the decrement in the local array item quantity so future picks in the same transaction loop are correct
            stock.quantity = this.round(stock.quantity - take);
        }

        if (this.round(remainingToPick) > 0) {
            if (allowShortage) {
                pickedBatches.push({
                    batchId: null,
                    quantity: this.round(remainingToPick),
                    batch: { unitPrice: 0, costPrice: 0 } as any
                });
            } else {
                throw new Error(`INSUFFICIENT_BATCH_STOCK_FOR_ITEM_${itemId}: Missing ${remainingToPick}`);
            }
        }

        return pickedBatches;
    }

    /**
     * Pick batches from a contractor based on FIFO with locking
     */
    static async pickContractorBatchesFIFO(tx: TransactionClient, contractorId: string, itemId: string, requiredQty: number, allowShortage: boolean = false): Promise<PickedBatch[]> {
        const qtyToPick = this.round(requiredQty);
        const batches = await ContractorRepository.findAvailableBatches(contractorId, itemId, tx as any);

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
            if (allowShortage) {
                pickedBatches.push({
                    batchId: null,
                    quantity: this.round(remainingToPick),
                    batch: { unitPrice: 0, costPrice: 0 } as any
                });
            } else {
                throw new Error(`INSUFFICIENT_CONTRACTOR_BATCH_STOCK_FOR_ITEM_${itemId}: Missing ${remainingToPick}`);
            }
        }

        return pickedBatches;
    }

    /**
     * Pick batches from pre-fetched available contractor batches list in-memory using FIFO
     */
    static pickContractorBatchesFIFOBulk(availableBatches: any[], itemId: string, requiredQty: number, allowShortage: boolean = false): PickedBatch[] {
        const qtyToPick = this.round(requiredQty);
        const itemBatches = availableBatches.filter(b => b.itemId === itemId);

        const pickedBatches: PickedBatch[] = [];
        let remainingToPick = qtyToPick;

        for (const stock of itemBatches) {
            if (remainingToPick <= 0) break;
            const available = this.round(stock.quantity);
            const take = Math.min(available, remainingToPick);
            pickedBatches.push({
                batchId: stock.batchId,
                quantity: this.round(take),
                batch: stock.batch
            });
            remainingToPick = this.round(remainingToPick - take);
            stock.quantity = this.round(stock.quantity - take);
        }

        if (this.round(remainingToPick) > 0) {
            if (allowShortage) {
                pickedBatches.push({
                    batchId: null,
                    quantity: this.round(remainingToPick),
                    batch: { unitPrice: 0, costPrice: 0 } as any
                });
            } else {
                throw new Error(`INSUFFICIENT_CONTRACTOR_BATCH_STOCK_FOR_ITEM_${itemId}: Missing ${remainingToPick}`);
            }
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

                const currentStock = await InventoryRepository.findStock(storeId, item.itemId, tx);
                const oldQty = currentStock ? this.round(currentStock.quantity) : 0;
                const diff = this.round(newQty - oldQty);

                if (diff === 0) continue; // No change

                // A. BATCH HANDLING
                if (diff > 0) {
                    const itemData = await InventoryRepository.findItemById(item.itemId, tx);

                    const batch = await InventoryRepository.createBatch({
                        batchNumber: `ADJ-${Date.now()}`,
                        itemId: item.itemId,
                        initialQty: diff,
                        costPrice: itemData?.costPrice || 0,
                        unitPrice: itemData?.unitPrice || 0
                    }, tx);

                    await InventoryRepository.createBatchStock({
                        storeId,
                        batchId: batch.id,
                        itemId: item.itemId,
                        quantity: diff
                    }, tx);
                } else {
                    const reduceQty = Math.abs(diff);
                    const pickedBatches = await this.pickStoreBatchesFIFO(tx, storeId, item.itemId, reduceQty);

                    for (const picked of pickedBatches) {
                        await InventoryRepository.updateBatchStock(storeId, picked.batchId!, -picked.quantity, tx);
                    }
                }

                // B. UPDATE GLOBAL STOCK
                await InventoryRepository.upsertStock(storeId, item.itemId, diff, tx);

                transactionItems.push({
                    itemId: item.itemId,
                    quantity: diff,
                    beforeQty: oldQty,
                    afterQty: newQty
                });
            }

            if (transactionItems.length > 0) {
                await InventoryRepository.createTransaction({
                    type: 'ADJUSTMENT',
                    storeId,
                    userId: userId || 'SYSTEM',
                    referenceId: `INIT-STOCK-${Date.now()}`,
                    notes: reason || 'Initial Stock Setup',
                    items: {
                        create: transactionItems.map((ti: any) => ({
                            itemId: ti.itemId,
                            quantity: ti.quantity
                        }))
                    }
                }, tx);
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
        items: { itemId: string; quantity: string | number; remarks?: string; serials?: string[] }[];
    }) {
        const { storeId, issuedById, issueType, projectId, contractorId, teamId, recipientName, remarks, items } = data;

        if (!storeId || !issuedById || !recipientName || !items || items.length === 0) {
            throw new Error('MISSING_FIELDS');
        }

        return await prisma.$transaction(async (tx: TransactionClient) => {
            const issueNumber = `ISS-${Date.now()}`;
            const isContractorIssue = issueType === 'CONTRACTOR' && !!contractorId;

            // Validate all serials (exist, match item, available in store)
            for (const item of items) {
                if (item.serials && Array.isArray(item.serials) && item.serials.length > 0) {
                    for (const sn of item.serials) {
                        const serialNum = sn.trim();
                        if (!serialNum) continue;

                        const serialRecord = await tx.inventoryItemSerial.findUnique({
                            where: { serialNumber: serialNum }
                        });

                        if (!serialRecord) {
                            throw new Error(`SERIAL_NOT_FOUND: ${serialNum}`);
                        }
                        if (serialRecord.itemId !== item.itemId) {
                            throw new Error(`SERIAL_ITEM_MISMATCH: Serial ${serialNum} does not match item ${item.itemId}`);
                        }
                        if (serialRecord.status !== 'IN_STORE' || serialRecord.storeId !== storeId) {
                            throw new Error(`SERIAL_NOT_AVAILABLE_IN_STORE: Serial ${serialNum} is not available in store ${storeId}`);
                        }
                    }
                }
            }

            if (isContractorIssue) {
                const { IssueService } = await import('./issue.service');
                const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
                
                // Delegate core stock movement, batch updates, and contractor stock updates
                await IssueService.issueMaterial({
                    contractorId: contractorId!,
                    storeId,
                    month: currentMonth,
                    items: items.map(item => ({
                        itemId: item.itemId,
                        quantity: parseFloat(item.quantity.toString()),
                        serials: item.serials
                    })),
                    userId: issuedById
                }, tx);
            } else {
                // Default path for PROJECTS, TEAMS, etc.
                const transactionItems: { itemId: string; batchId: string; quantity: number }[] = [];

                for (const item of items) {
                    const quantity = parseFloat(item.quantity.toString());

                    const existingStock = await InventoryRepository.findStock(storeId, item.itemId, tx);

                    if (!existingStock || existingStock.quantity < quantity) {
                        throw new Error(`INSUFFICIENT_STOCK: ${item.itemId}`);
                    }

                    // A. Pick store batches FIFO and decrement batch stock
                    const pickedBatches = await this.pickStoreBatchesFIFO(tx, storeId, item.itemId, quantity);
                    for (const picked of pickedBatches) {
                        if (picked.batchId) {
                            await tx.inventoryBatchStock.update({
                                where: { storeId_batchId: { storeId, batchId: picked.batchId } },
                                data: { quantity: { decrement: picked.quantity } }
                            });
                            
                            transactionItems.push({
                                itemId: item.itemId,
                                batchId: picked.batchId,
                                quantity: -picked.quantity
                            });
                        }
                    }

                    // B. Decrement global store stock
                    await InventoryRepository.updateStock(storeId, item.itemId, { quantity: { decrement: quantity } }, tx);

                    // D. Update serial status if serials are provided in the payload
                    if (item.serials && Array.isArray(item.serials) && item.serials.length > 0) {
                        for (const sn of item.serials) {
                            const serialNum = sn.trim();
                            if (!serialNum) continue;

                            await tx.inventoryItemSerial.update({
                                where: { serialNumber: serialNum },
                                data: {
                                    status: 'ISSUED',
                                    storeId: null,
                                    contractorId: contractorId || null
                                }
                            });
                        }
                    }
                }

                // C. Log transaction and transaction items with batchId (Single Transaction Header)
                if (transactionItems.length > 0) {
                    await InventoryRepository.createTransaction({
                        type: 'TRANSFER_OUT',
                        storeId,
                        userId: issuedById,
                        referenceId: issueNumber,
                        notes: `Issued to ${recipientName} - ${issueType}`,
                        items: {
                            create: transactionItems.map(ti => ({
                                itemId: ti.itemId,
                                batchId: ti.batchId,
                                quantity: ti.quantity
                            }))
                        }
                    }, tx);
                }
            }

            // Always create the StockIssue and StockIssueItem records for history tracking
            const issue = await InventoryRepository.createStockIssue({
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
                    create: items.map((item: any) => ({
                        itemId: item.itemId,
                        quantity: parseFloat(item.quantity.toString()),
                        remarks: item.remarks || null
                    }))
                }
            }, tx);

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

        return await InventoryRepository.findManyStockIssues({
            where,
            include: {
                items: { include: { item: true } },
                issuedBy: { select: { id: true, name: true } },
                project: { select: { id: true, name: true } },
                contractor: { select: { id: true, name: true } }
            },
            orderBy: { createdAt: 'desc' }
        }) as StockIssue[];
    }

    /**
     * Get item serials in store
     */
    static async getItemSerials(storeId: string, itemId: string) {
        if (!storeId || !itemId) throw new Error('MISSING_PARAMS');
        
        return await prisma.inventoryItemSerial.findMany({
            where: {
                storeId,
                itemId,
                status: 'IN_STORE'
            },
            orderBy: { serialNumber: 'asc' }
        });
    }

    /**
     * Get serials with advanced filtering
     */
    static async getAllSerials(filters: { storeId?: string, itemId?: string, search?: string, staffId?: string }) {
        const { storeId, itemId, search, staffId } = filters;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const where: any = {};
        
        if (storeId) where.storeId = storeId;
        if (itemId) where.itemId = itemId;
        if (search) where.serialNumber = { contains: search, mode: 'insensitive' };
        if (staffId) where.assignedStaffId = staffId;

        return await prisma.inventoryItemSerial.findMany({
            where,
            include: {
                item: true,
                store: true,
                assignedStaff: true
            },
            orderBy: { updatedAt: 'desc' },
            take: 100
        });
    }
}
