import { AppError } from '@/lib/error';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { StockService } from './stock.service';
import { StoreService } from './store.service';
import { AuditLedgerService } from './audit-ledger.service';
import { emitSystemEvent } from '@/lib/events';
import { TransactionClient } from './types';
import { InventoryRepository } from '@/repositories/inventory.repository';
import { ContractorRepository } from '@/repositories/contractor.repository';

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
        items: { itemId: string; quantity: string | number; unit?: string; serials?: string[] }[];
        userId?: string;
    }, tx?: TransactionClient) {
        const { contractorId, storeId, month, items, userId } = data;

        const execute = async (transaction: TransactionClient) => {
            // Generate MIN issue number atomically
            const issueNumber = await AuditLedgerService.generateMINNumber(transaction);

            // 1. Create Material Issue
            const materialIssue = await (transaction as any).contractorMaterialIssue.create({
                data: {
                    issueNumber,
                    contractorId,
                    storeId,
                    month,
                    issueDate: new Date(),
                    issuedBy: userId || 'SYSTEM',
                    items: {
                        create: items.map((i: any) => ({
                            itemId: i.itemId,
                            quantity: parseFloat(i.quantity.toString()),
                            unit: i.unit || 'Nos'
                        }))
                    }
                }
            });

            // 2. FIFO Stock Deduction & Batch Transfer
            const transactionItems: { itemId: string; batchId: string; quantity: number }[] = [];

            for (const item of items) {
                const qty = StockService.round(parseFloat(item.quantity.toString()));
                if (qty <= 0) continue;

                // A. Pick Batches using FIFO
                const pickedBatches = await StockService.pickStoreBatchesFIFO(transaction, storeId, item.itemId, qty);

                for (const picked of pickedBatches) {
                    if (!picked.batchId) continue; // Safety check
                    // Reduce from Store Batch Stock
                    
                    await InventoryRepository.decrementBatchStockAtomic(storeId, picked.batchId, picked.quantity, transaction);

                    // Add to Contractor Batch Stock
                    
                    await (transaction as any).contractorBatchStock.upsert({
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
                const updatedStoreStock = await InventoryRepository.decrementStockAtomic(storeId, item.itemId, qty, transaction);

                // Write Immutable Inventory Ledger Entry
                const currentQtyAfter = updatedStoreStock?.quantity ? Number(updatedStoreStock.quantity) : 0;
                await AuditLedgerService.recordEntry({
                    storeId,
                    itemId: item.itemId,
                    transactionType: 'CONTRACTOR_ISSUE',
                    referenceType: 'ContractorMaterialIssue',
                    referenceId: materialIssue.id,
                    quantityBefore: currentQtyAfter + qty,
                    quantityChange: -qty,
                    quantityAfter: currentQtyAfter,
                    performedById: userId || 'SYSTEM'
                }, transaction);

                // E. Update Contractor Total Stock
                
                await (transaction as any).contractorStock.upsert({
                    where: { contractorId_itemId: { contractorId, itemId: item.itemId } },
                    update: { quantity: { increment: qty } },
                    create: { contractorId, itemId: item.itemId, quantity: qty }
                });

                // F. Update serials status if issued and serials are provided with strict verification
                if (item.serials && Array.isArray(item.serials) && item.serials.length > 0) {
                    for (const sn of item.serials) {
                        const serialNum = sn.trim();
                        if (!serialNum) continue;

                        const serialRecord = await transaction.inventoryItemSerial.findUnique({
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

                        await transaction.inventoryItemSerial.update({
                            where: { id: serialRecord.id },
                            data: {
                                status: 'ISSUED',
                                contractorId: contractorId,
                                storeId: null,
                                sodId: null
                            }
                        });
                    }
                }
            }

            // 3. Log Transfer-Out Transaction
            
            await (transaction as any).inventoryTransaction.create({
                data: {
                    type: 'TRANSFER_OUT',
                    storeId,
                    userId: userId || 'SYSTEM',
                    referenceId: materialIssue.id,
                    notes: `Material Issue ${materialIssue.id} for ${month}`,
                    items: {
                        
                        create: transactionItems.map((ti: any) => ({
                            itemId: ti.itemId,
                            batchId: ti.batchId,
                            quantity: ti.quantity
                        }))
                    }
                }
            });

            return materialIssue;
        };

        if (tx) {
            return await execute(tx);
        }

        const result = await prisma.$transaction(async (t: TransactionClient) => {
            return await execute(t);
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
        items: { itemId: string; quantity: string | number; unit?: string; condition?: string; serials?: string[] }[];
        userId: string;
    }) {
        const { contractorId, storeId, month, reason, items, userId } = data;

        if (!contractorId || !storeId || !month || !items || !Array.isArray(items) || items.length === 0) {
            throw AppError.badRequest('MISSING_FIELDS');
        }

        return await prisma.$transaction(async (tx: TransactionClient) => {
            // 1. Create Return Record with atomic MRN number
            const returnNumber = await AuditLedgerService.generateMRNNumber(tx);

            const materialReturn = await tx.contractorMaterialReturn.create({
                data: {
                    returnNumber,
                    contractorId,
                    storeId,
                    month,
                    reason,
                    status: 'ACCEPTED',
                    acceptedBy: userId,
                    acceptedAt: new Date(),
                    returnDate: new Date(), // Added from edit
                    items: {
                        
                        create: items.map((item: any) => ({
                            itemId: item.itemId,
                            quantity: parseFloat(item.quantity.toString()),
                            unit: item.unit || 'Nos',
                            condition: item.condition || 'GOOD'
                        }))
                    }
                }
            });

            // 2. FIFO Stock Deduction from Contractor & Add to Store
            const transactionItems: { itemId: string; batchId: string; quantity: number }[] = []; // Added for transaction log

            for (const item of items) {
                const qty = StockService.round(parseFloat(item.quantity.toString()));
                if (qty <= 0) continue;

                // A. FIFO Deduction from Contractor
                const pickedBatches = await StockService.pickContractorBatchesFIFO(tx, contractorId, item.itemId, qty);

                for (const picked of pickedBatches) {
                    if (!picked.batchId) continue; // Safety check
                    
                    await ContractorRepository.decrementBatchStockAtomic(contractorId, picked.batchId, picked.quantity, tx);

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
                        transactionItems.push({ itemId: item.itemId, batchId: picked.batchId, quantity: picked.quantity }); // Log only good items
                    }
                }

                
                await ContractorRepository.decrementStockAtomic(contractorId, item.itemId, qty, tx);

                if (item.condition === 'GOOD') {
                    const existingStoreStock = await tx.inventoryStock.findUnique({
                        where: { storeId_itemId: { storeId, itemId: item.itemId } }
                    });
                    const quantityBefore = existingStoreStock ? Number(existingStoreStock.quantity) : 0;

                    await tx.inventoryStock.upsert({
                        where: { storeId_itemId: { storeId, itemId: item.itemId } },
                        update: { quantity: { increment: qty } },
                        create: { storeId, itemId: item.itemId, quantity: qty }
                    });

                    // Write Immutable Inventory Ledger Entry for store restock
                    await AuditLedgerService.recordEntry({
                        storeId,
                        itemId: item.itemId,
                        transactionType: 'MRN_APPROVAL',
                        referenceType: 'MRN',
                        referenceId: materialReturn.id,
                        quantityBefore,
                        quantityChange: qty,
                        quantityAfter: quantityBefore + qty,
                        performedById: userId || 'SYSTEM',
                        idempotencyKey: `return-create-${materialReturn.id}-${item.itemId}`
                    }, tx);
                }

                // Update serials status if returned and serials are provided
                if (item.serials && Array.isArray(item.serials) && item.serials.length > 0) {
                    for (const sn of item.serials) {
                        const serialNum = sn.trim();
                        if (!serialNum) continue;

                        await tx.inventoryItemSerial.update({
                            where: { serialNumber: serialNum },
                            data: {
                                status: item.condition === 'GOOD' ? 'IN_STORE' : 'FAULTY',
                                storeId: storeId,
                                contractorId: null,
                                sodId: null
                            }
                        });
                    }
                }

                // Removed old inventoryTransaction.create for each item
            }

            // 3. Log Transfer-In Transaction
            
            await tx.inventoryTransaction.create({
                data: {
                    type: 'TRANSFER_IN',
                    storeId,
                    userId: userId || 'SYSTEM',
                    referenceId: materialReturn.id,
                    notes: `Material Return ${materialReturn.id}`,
                    items: {
                        
                        create: transactionItems.map((ti: any) => ({
                            itemId: ti.itemId,
                            batchId: ti.batchId,
                            quantity: ti.quantity
                        }))
                    }
                }
            });

            return materialReturn; // Changed from returnRecord to materialReturn
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
