import { AppError } from '@/lib/error';

import { prisma } from '@/lib/prisma';
import { Prisma, InventoryBatchStock, ContractorBatchStock, StockIssue } from '@prisma/client';
import { TransactionClient, PickedBatch, UUID } from '@/types/inventory/inventory-service.types';
import { InventoryRepository } from '@/repositories/inventory.repository';
import { ContractorRepository } from '@/repositories/contractor.repository';
import { AuditLedgerService } from './audit-ledger.service';
import { StoreService } from './store.service';

export class StockService {
    // Round to 4 decimal places to prevent floating point issues
    static round(val: number): number {
        return Math.round(val * 10000) / 10000;
    }

    static async getStock(storeId: UUID) {
        if (!storeId) throw AppError.badRequest('STORE_ID_REQUIRED');

        const whereClause = storeId === 'all' ? {} : { storeId };

        return await InventoryRepository.findManyStocks(
            whereClause,
            { item: true }
        );
    }

    static async getStoreBatches(storeId: UUID, itemId?: UUID): Promise<InventoryBatchStock[]> {
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

    static async getContractorBatches(contractorId: UUID, itemId?: UUID): Promise<ContractorBatchStock[]> {
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
     * Pick batches from a store based on FIFO using DB function fn_fifo_pick_store_batches()
     * Orders by expiryDate ASC (nulls last), then createdAt ASC (FEFO)
     * Runs entirely in PostgreSQL - no data egress.
     */
    static async pickStoreBatchesFIFO(tx: TransactionClient, storeId: UUID, itemId: UUID, requiredQty: number, allowShortage: boolean = false): Promise<PickedBatch[]> {
        const qtyToPick = this.round(requiredQty);

        // Call DB function for atomic FIFO picking in PostgreSQL
        const result = await tx.$queryRaw<Array<{
            batch_id: UUID | null;
            available_qty: number;
            pick_qty: number;
            batch_created_at: Date | null;
            batch_expiry_date: Date | null;
            cost_price: number;
            unit_price: number;
        }>>`
            SELECT * FROM fn_fifo_pick_store_batches(
                ${storeId}::uuid,
                ${itemId}::uuid,
                ${qtyToPick}::decimal
            )
        `;

        const pickedBatches: PickedBatch[] = result.map(row => ({
            batchId: row.batch_id,
            quantity: this.round(row.pick_qty),
            batch: {
                unitPrice: Number(row.unit_price) || 0,
                costPrice: Number(row.cost_price) || 0,
                expiryDate: row.batch_expiry_date,
                createdAt: row.batch_created_at
            } as any
        }));

        // Check for shortage (batch_id = NULL row)
        const shortageRow = pickedBatches.find(p => p.batchId === null);
        if (shortageRow) {
            if (!allowShortage) {
                throw AppError.badRequest(`INSUFFICIENT_BATCH_STOCK_FOR_ITEM_${itemId}: Missing ${shortageRow.quantity}`);
            }
        }

        return pickedBatches;
    }

    /**
     * Pick batches from pre-fetched available store batches list in-memory using FIFO
     */
    static pickStoreBatchesFIFOBulk(availableBatches: Array<{ id: UUID; itemId: UUID; quantity: import('@prisma/client').Prisma.Decimal | number; batchId: UUID }>, itemId: UUID, requiredQty: number, allowShortage: boolean = false): PickedBatch[] {
        const qtyToPick = this.round(requiredQty);
        // Filter batches for this itemId in memory
        const itemBatches = availableBatches.filter(b => b.itemId === itemId);

        const pickedBatches: PickedBatch[] = [];
        let remainingToPick = qtyToPick;

        for (const stock of itemBatches) {
            if (remainingToPick <= 0) break;
            const available = this.round(Number(stock.quantity));
            const take = Math.min(available, remainingToPick);
            pickedBatches.push({
                batchId: stock.batchId,
                quantity: this.round(take),
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                batch: (stock as any).batch || { unitPrice: 0, costPrice: 0 }
            });
            remainingToPick = this.round(remainingToPick - take);
            // Reflect the decrement in the local array item quantity so future picks in the same transaction loop are correct
            stock.quantity = this.round(Number(stock.quantity) - take);
        }

        if (this.round(remainingToPick) > 0) {
            if (allowShortage) {
                pickedBatches.push({
                    batchId: null,
                    quantity: this.round(remainingToPick),
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    batch: { unitPrice: 0, costPrice: 0 } as any
                });
            } else {
                throw AppError.badRequest(`INSUFFICIENT_BATCH_STOCK_FOR_ITEM_${itemId}: Missing ${remainingToPick}`);
            }
        }

        return pickedBatches;
    }

    /**
     * Pick batches from a contractor based on FIFO using DB function fn_fifo_pick_contractor_batches()
     * Orders by createdAt ASC (FIFO)
     * Runs entirely in PostgreSQL - no data egress.
     */
    static async pickContractorBatchesFIFO(tx: TransactionClient, contractorId: UUID, itemId: UUID, requiredQty: number, allowShortage: boolean = false): Promise<PickedBatch[]> {
        const qtyToPick = this.round(requiredQty);

        // Call DB function for atomic FIFO picking in PostgreSQL
        const result = await tx.$queryRaw<Array<{
            batch_id: UUID | null;
            available_qty: number;
            pick_qty: number;
            batch_created_at: Date | null;
            cost_price: number;
            unit_price: number;
        }>>`
            SELECT * FROM fn_fifo_pick_contractor_batches(
                ${contractorId}::uuid,
                ${itemId}::uuid,
                ${qtyToPick}::decimal
            )
        `;

        const pickedBatches: PickedBatch[] = result.map(row => ({
            batchId: row.batch_id,
            quantity: this.round(row.pick_qty),
            batch: {
                unitPrice: Number(row.unit_price) || 0,
                costPrice: Number(row.cost_price) || 0,
                createdAt: row.batch_created_at
            } as any
        }));

        // Check for shortage (batch_id = NULL row)
        const shortageRow = pickedBatches.find(p => p.batchId === null);
        if (shortageRow) {
            if (!allowShortage) {
                throw AppError.badRequest(`INSUFFICIENT_CONTRACTOR_BATCH_STOCK_FOR_ITEM_${itemId}: Missing ${shortageRow.quantity}`);
            }
        }

        return pickedBatches;
    }

    /**
     * Pick batches from pre-fetched available contractor batches list in-memory using FIFO
     */
    static pickContractorBatchesFIFOBulk(availableBatches: Array<{ id: UUID; itemId: UUID; quantity: import('@prisma/client').Prisma.Decimal | number; batchId: UUID }>, itemId: UUID, requiredQty: number, allowShortage: boolean = false): PickedBatch[] {
        const qtyToPick = this.round(requiredQty);
        const itemBatches = availableBatches.filter(b => b.itemId === itemId);

        const pickedBatches: PickedBatch[] = [];
        let remainingToPick = qtyToPick;

        for (const stock of itemBatches) {
            if (remainingToPick <= 0) break;
            const available = this.round(Number(stock.quantity));
            const take = Math.min(available, remainingToPick);
            pickedBatches.push({
                batchId: stock.batchId,
                quantity: this.round(take),
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                batch: (stock as any).batch || { unitPrice: 0, costPrice: 0 }
            });
            remainingToPick = this.round(remainingToPick - take);
            stock.quantity = this.round(Number(stock.quantity) - take);
        }

        if (this.round(remainingToPick) > 0) {
            if (allowShortage) {
                pickedBatches.push({
                    batchId: null,
                    quantity: this.round(remainingToPick),
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    batch: { unitPrice: 0, costPrice: 0 } as any
                });
            } else {
                throw AppError.badRequest(`INSUFFICIENT_CONTRACTOR_BATCH_STOCK_FOR_ITEM_${itemId}: Missing ${remainingToPick}`);
            }
        }

        return pickedBatches;
    }

    /**
     * Initialize or Adjust Stock Levels in Bulk
     */
    static async initializeStock(storeId: UUID, items: { itemId: UUID; quantity: string | number }[], reason?: string, userId?: string) {
        if (!storeId || !Array.isArray(items)) throw AppError.badRequest('INVALID_PAYLOAD');

        // Store-Scope Enforcement: caller must be authorized for the target store
        await StoreService.assertStoreWriteAccess(userId, storeId);

        return await prisma.$transaction(async (tx: TransactionClient) => {
            // Delegate bulk stock operations to fn_bulk_stock_initialize (single atomic DB call)
            const itemIds = items.map(i => i.itemId);
            const quantities = items.map(i => this.round(parseFloat(i.quantity.toString())));

            const bulkResult = await tx.$queryRaw<Array<{
                item_id: UUID;
                old_qty: number;
                new_qty: number;
            }>>`
                SELECT * FROM fn_bulk_stock_initialize(
                    ${storeId}::uuid,
                    ${itemIds}::uuid[],
                    ${quantities}::numeric[]
                )
            `;

            const transactionItems = bulkResult
                .filter(r => Number(r.old_qty) !== Number(r.new_qty))
                .map(r => ({
                    itemId: r.item_id,
                    quantity: this.round(Number(r.new_qty) - Number(r.old_qty)),
                    beforeQty: this.round(Number(r.old_qty)),
                    afterQty: this.round(Number(r.new_qty))
                }));

            if (transactionItems.length > 0) {
                await InventoryRepository.createTransaction({
                    type: 'ADJUSTMENT',
                    storeId,
                    userId: userId || 'SYSTEM',
                    referenceId: `INIT-STOCK-${Date.now()}`,
                    notes: reason || 'Initial Stock Setup',
                    items: {
                        create: transactionItems.map((ti) => ({
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
        storeId: UUID;
        issuedById: string;
        issueType: string;
        projectId?: UUID;
        contractorId?: UUID;
        teamId?: UUID;
        recipientName: string;
        remarks?: string;
        items: { itemId: UUID; quantity: string | number; remarks?: string; serials?: string[] }[];
    }) {
        const { storeId, issuedById, issueType, projectId, contractorId, teamId, recipientName, remarks, items } = data;

        if (!storeId || !issuedById || !recipientName || !items || items.length === 0) {
            throw AppError.badRequest('MISSING_FIELDS');
        }

        // Store-Scope Enforcement: caller must be authorized for the issuing store
        await StoreService.assertStoreWriteAccess(issuedById, storeId);

        return await prisma.$transaction(async (tx: TransactionClient) => {
            const issueNumber = await AuditLedgerService.getNextDocumentNumber('ISS', tx);
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
                            throw AppError.badRequest(`SERIAL_NOT_FOUND: ${serialNum}`);
                        }
                        if (serialRecord.itemId !== item.itemId) {
                            throw AppError.badRequest(`SERIAL_ITEM_MISMATCH: Serial ${serialNum} does not match item ${item.itemId}`);
                        }
                        if (serialRecord.status !== 'IN_STORE' || serialRecord.storeId !== storeId) {
                            throw AppError.badRequest(`SERIAL_NOT_AVAILABLE_IN_STORE: Serial ${serialNum} is not available in store ${storeId}`);
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
                // Delegate bulk stock issue to fn_bulk_stock_issue (single atomic DB call)
                const itemIds = items.map(i => i.itemId);
                const quantities = items.map(i => parseFloat(i.quantity.toString()));
                const serials2d = items.map(i => i.serials && Array.isArray(i.serials) ? i.serials : []);

                const bulkResult = await tx.$queryRaw<Array<{
                    item_id: UUID;
                    batch_id: UUID;
                    picked_qty: number;
                }>>`
                    SELECT * FROM fn_bulk_stock_issue(
                        ${storeId}::uuid,
                        ${itemIds}::uuid[],
                        ${quantities}::numeric[],
                        ${issuedById}::uuid,
                        ${issueNumber}::text,
                        ${issueType}::text,
                        ${contractorId || null}::uuid,
                        ${serials2d}::text[][]
                    )
                `;

                // Build transaction items from DB function results
                const transactionItems = bulkResult.map(r => ({
                    itemId: r.item_id,
                    batchId: r.batch_id,
                    quantity: -Math.abs(Number(r.picked_qty))
                }));

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
                    create: items.map((item) => ({
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
    static async getItemSerials(storeId: UUID, itemId: UUID) {
        if (!storeId || !itemId) throw AppError.badRequest('MISSING_PARAMS');
        
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
        
        const where: import('@prisma/client').Prisma.InventoryItemSerialWhereInput = {};
        
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
