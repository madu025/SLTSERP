import { AppError } from '@/lib/error';
import { prisma } from '@/lib/prisma';
import { StockService } from './stock.service';
import { AuditService } from '@/services/audit/audit.service';
import { AuditLedgerService } from './audit-ledger.service';
import { UUID } from '@/types/common';
import { TransactionClient } from '@/types/inventory/inventory-service.types';
import { LedgerService } from '../finance/ledger.service';
import { ContractorRepository } from '@/repositories/contractor.repository';
import { InventoryRepository } from '@/repositories/inventory.repository';

export class WastageService {
    /**
     * Record a new wastage incident. 
     * Includes logic for automatic approval vs pending based on item settings.
     */
    static async recordWastage(data: {
        storeId?: string;
        contractorId?: string;
        month?: string;
        description?: string;
        reason?: string;
        items: { itemId: string; quantity: string | number; unit?: string }[];
        userId?: string;
    }) {
        const { storeId, contractorId, month, description, reason, items, userId } = data;

        // 1. Identify if approval is needed based on DB flags
        // flag: isWastageAllowed (if false, needs approval)
        // flag: maxWastagePercentage (if exceeded, needs approval)
        const itemMetas = await prisma.inventoryItem.findMany({ select: { id: true, name: true, unitPrice: true, costPrice: true, maxWastagePercentage: true, isWastageAllowed: true },
            where: { id: { in: items.map(i => i.itemId) } }
        });

        // Delegate wastage approval check to fn_wastage_approval_check (single DB call replaces JS nested loop)
        const wastageItemIds = items.map(i => i.itemId);
        const wastageQuantities = items.map(i => parseFloat(i.quantity.toString()));

        // Validate quantities up-front
        for (const item of items) {
            const meta = itemMetas.find(m => m.id === item.itemId);
            if (!meta) continue;
            const requestedQty = parseFloat(item.quantity.toString());
            if (!Number.isFinite(requestedQty) || requestedQty < 0) {
                throw AppError.badRequest(`INVALID_WASTAGE_QUANTITY: ${meta.name} quantity must be zero or positive`);
            }
        }

        const approvalResult = await prisma.$queryRaw<Array<{
            requires_approval: boolean;
            total_wastage_value: number;
            excess_details: string;
        }>>`
            SELECT * FROM fn_wastage_approval_check(
                ${contractorId || null}::uuid,
                ${storeId || null}::uuid,
                ${(month || new Date().toISOString().slice(0, 7))}::text,
                ${wastageItemIds}::uuid[],
                ${wastageQuantities}::numeric[]
            )
        `;

        const result = approvalResult[0] || { requires_approval: false, total_wastage_value: 0, excess_details: '' };
        let requiresApproval = result.requires_approval;
        const totalWastageValue = Number(result.total_wastage_value);
        const excessDetails: string[] = result.excess_details
            ? result.excess_details.split('; ').filter(s => s.trim())
            : [];

        // Contractors must NEVER get automatic approval (strict anti-fraud compliance check)
        if (contractorId) {
            requiresApproval = true;
        }

        const status = requiresApproval ? 'PENDING' : 'APPROVED';

        // SCENARIO 1: Contractor Wastage
        if (contractorId) {
            if (!storeId) throw AppError.badRequest('STORE_ID_REQUIRED');

            return await prisma.$transaction(async (tx: TransactionClient) => {
                
                const wastage = await tx.contractorWastage.create({
                    data: {
                        contractorId,
                        storeId,
                        month: month || new Date().toISOString().slice(0, 7),
                        description: excessDetails.length > 0
                            ? `[EXCESS_WASTAGE: ${excessDetails.join(', ')}] ${description || reason || ''}`
                            : (description || reason),
                        status: status,
                        items: {
                            create: items.map((item) => ({
                                itemId: item.itemId,
                                quantity: parseFloat(item.quantity.toString()),
                                unit: item.unit || 'Nos'
                            }))
                        }
                    }
                });

                // 2. Only deduct stock if status is APPROVED
                if (status === 'APPROVED') {
                    for (const item of items) {
                        const qty = StockService.round(parseFloat(item.quantity.toString()));
                        if (qty <= 0) continue;

                        const pickedBatches = await StockService.pickContractorBatchesFIFO(tx, contractorId, item.itemId, qty);
                        for (const picked of pickedBatches) {
                            
                            await ContractorRepository.decrementBatchStockAtomic(contractorId, picked.batchId!, picked.quantity, tx);
                        }

                        await ContractorRepository.decrementStockAtomic(contractorId, item.itemId, qty, tx);

                        // Write Immutable Inventory Ledger Entry for the contractor wastage
                        await AuditLedgerService.recordEntry({
                            storeId,
                            itemId: item.itemId,
                            transactionType: 'WASTAGE_ADJUSTMENT',
                            referenceType: 'ContractorWastage',
                            referenceId: wastage.id,
                            quantityBefore: 0,
                            quantityChange: -qty,
                            quantityAfter: 0,
                            performedById: userId || 'SYSTEM',
                            idempotencyKey: `wastage-record-${wastage.id}-${item.itemId}`
                        }, tx);
                    }
                    await LedgerService.logWastage(tx, wastage.id, totalWastageValue);
                }

                if (userId) {
                    await AuditService.log({
                        userId,
                        action: 'RECORD_CONTRACTOR_WASTAGE',
                        entity: 'ContractorWastage',
                        entityId: wastage.id,
                        newValue: wastage
                    });
                }

                return { 
                    success: true, 
                    message: status === 'APPROVED' ? 'Wastage recorded' : 'Wastage recorded and pending approval', 
                    id: wastage.id,
                    status
                };
            }, { timeout: 20000 });
        }

        // SCENARIO 2: Store Wastage
        if (!storeId) throw AppError.badRequest('STORE_ID_REQUIRED_FOR_STORE_WASTAGE');

        return await prisma.$transaction(async (tx: TransactionClient) => {
            const transactionItems: { itemId: UUID; quantity: number; batchId: UUID | null }[] = [];

            for (const item of items) {
                const qty = StockService.round(parseFloat(item.quantity.toString()));
                if (qty <= 0) continue;

                if (status === 'APPROVED') {
                    const pickedBatches = await StockService.pickStoreBatchesFIFO(tx, storeId, item.itemId, qty);
                    for (const picked of pickedBatches) {
                        if (picked.batchId) {
                            
                            await InventoryRepository.decrementBatchStockAtomic(storeId, picked.batchId!, picked.quantity, tx);
                        }
                        transactionItems.push({
                            itemId: item.itemId,
                            quantity: -Number(picked.quantity),
                            batchId: picked.batchId
                        });
                    }

                    
                    await InventoryRepository.decrementStockAtomic(storeId, item.itemId, qty, tx);
                } else {
                    transactionItems.push({
                        itemId: item.itemId,
                        quantity: -Number(qty),
                        batchId: null
                    });
                }
            }

            
            const txRecord = await tx.inventoryTransaction.create({
                data: {
                    type: 'WASTAGE',
                    storeId,
                    userId: userId || 'SYSTEM',
                    referenceId: `STORE-WASTAGE-${Date.now()}`,
                    notes: `[STATUS: ${status}] ${reason || description}`,
                    items: {
                        create: transactionItems.map((ti) => ({
                            itemId: ti.itemId,
                            quantity: ti.quantity,
                            batchId: ti.batchId
                        }))
                    }
                }
            });

            if (status === 'APPROVED') {
                await LedgerService.logWastage(tx, txRecord.id, totalWastageValue);
            }

            if (userId) {
                await AuditService.log({
                    userId,
                    action: 'RECORD_STORE_WASTAGE',
                    entity: 'InventoryTransaction',
                    entityId: txRecord.id,
                    newValue: txRecord
                });
            }

            return { ...txRecord, status };
        }, { timeout: 20000 });
    }

    /**
     * Approve a pending wastage record
     */
    static async approveWastage(wastageId: string, userId: string) {
        return await prisma.$transaction(async (tx: TransactionClient) => {
            
            const wastage = await tx.contractorWastage.findUnique({
                where: { id: wastageId },
                include: { items: true }
            });

            if (wastage) {
                if (wastage.status !== 'PENDING') throw AppError.badRequest('ALREADY_PROCESSED');

                const itemIds = wastage.items.map((i) => i.itemId);
                const itemMetas = await tx.inventoryItem.findMany({ select: { id: true, name: true, unitPrice: true, costPrice: true, maxWastagePercentage: true, isWastageAllowed: true },
                    where: { id: { in: itemIds } }
                });
                const metaMap = new Map(itemMetas.map((m) => [m.id, m]));

                const availableBatches = await ContractorRepository.findAvailableBatchesBulk(wastage.contractorId, itemIds, tx);

                let totalWastageValue = 0;
                // Apply DEDUCTIONS
                for (const item of wastage.items) {
                    const qty = StockService.round(item.quantity.toNumber());
                    if (qty <= 0) continue;

                    const itemMeta = metaMap.get(item.itemId);
                    const price = Number(itemMeta?.costPrice || itemMeta?.unitPrice || 0);
                    totalWastageValue += qty * price;

                    const pickedBatches = StockService.pickContractorBatchesFIFOBulk(availableBatches, item.itemId, qty);
                    for (const picked of pickedBatches) {
                        
                        await ContractorRepository.decrementBatchStockAtomic(wastage.contractorId, picked.batchId!, picked.quantity, tx);
                    }

                    
                    await ContractorRepository.decrementStockAtomic(wastage.contractorId, item.itemId, qty, tx);

                    // Write Immutable Inventory Ledger Entry for the approved contractor wastage
                    await AuditLedgerService.recordEntry({
                        storeId: wastage.storeId,
                        itemId: item.itemId,
                        transactionType: 'WASTAGE_ADJUSTMENT',
                        referenceType: 'ContractorWastage',
                        referenceId: wastage.id,
                        quantityBefore: 0,
                        quantityChange: -qty,
                        quantityAfter: 0,
                        performedById: userId,
                        idempotencyKey: `wastage-approve-${wastage.id}-${item.itemId}`
                    }, tx);
                }

                // Update Status
                
                const updated = await tx.contractorWastage.update({
                    where: { id: wastageId },
                    data: { 
                        status: 'APPROVED',
                        approvedById: userId,
                        approvedAt: new Date()
                    }
                });

                await LedgerService.logWastage(tx, wastage.id, totalWastageValue);

                return updated;
            } else {
                // If not found in ContractorWastage, check InventoryTransaction for Store Wastage
                
                const txRecord = await tx.inventoryTransaction.findUnique({
                    where: { id: wastageId },
                    include: { items: true }
                });

                if (!txRecord || txRecord.type !== 'WASTAGE') {
                    throw AppError.badRequest('WASTAGE_NOT_FOUND');
                }

                if (!txRecord.notes?.includes('[STATUS: PENDING]')) {
                    throw AppError.badRequest('ALREADY_PROCESSED');
                }

                const itemIds = txRecord.items.map((i) => i.itemId);
                const itemMetas = await tx.inventoryItem.findMany({ select: { id: true, name: true, unitPrice: true, costPrice: true, maxWastagePercentage: true, isWastageAllowed: true },
                    where: { id: { in: itemIds } }
                });
                const metaMap = new Map(itemMetas.map((m) => [m.id, m]));

                const availableBatches = await InventoryRepository.findAvailableBatchesBulk(txRecord.storeId, itemIds, tx);

                let totalWastageValue = 0;
                // Apply deductions for store wastage
                for (const item of txRecord.items) {
                    const qty = StockService.round(Math.abs(Number(item.quantity)));
                    if (qty <= 0) continue;

                    const itemMeta = metaMap.get(item.itemId);
                    const price = Number(itemMeta?.costPrice || itemMeta?.unitPrice || 0);
                    totalWastageValue += qty * price;

                    const pickedBatches = StockService.pickStoreBatchesFIFOBulk(availableBatches, item.itemId, qty);

                    // Delete the pending log item and recreate it split by batchIds
                    
                    await tx.inventoryTransactionItem.delete({
                        where: { id: item.id }
                    });

                    for (const picked of pickedBatches) {
                        if (picked.batchId) {
                            
                            await InventoryRepository.decrementBatchStockAtomic(txRecord.storeId, picked.batchId!, picked.quantity, tx);
                        }

                        // Recreate the transaction item with batch association
                        
                        await tx.inventoryTransactionItem.create({
                            data: {
                                transactionId: txRecord.id,
                                itemId: item.itemId,
                                quantity: -Number(picked.quantity),
                                batchId: picked.batchId
                            }
                        });
                    }

                    const updatedStoreStock = await InventoryRepository.decrementStockAtomic(txRecord.storeId, item.itemId, qty, tx);
                    const quantityAfter = updatedStoreStock?.quantity ? Number(updatedStoreStock.quantity) : 0;
                    
                    await AuditLedgerService.recordEntry({
                        storeId: txRecord.storeId,
                        itemId: item.itemId,
                        referenceId: `WASTAGE_${txRecord.id}`,
                        referenceType: 'Adjustment',
                        transactionType: 'WASTAGE_ADJUSTMENT',
                        quantityBefore: quantityAfter + qty,
                        quantityChange: -qty,
                        quantityAfter,
                        idempotencyKey: `WASTAGE_${txRecord.id}_${item.itemId}`,
                        performedById: 'system',
                    }, tx);
                }

                // Update the notes in the transaction to APPROVED
                const approvedNotes = txRecord.notes.replace('[STATUS: PENDING]', '[STATUS: APPROVED]');
                
                const updatedTx = await tx.inventoryTransaction.update({
                    where: { id: txRecord.id },
                    data: {
                        notes: approvedNotes,
                        userId
                    }
                });

                await LedgerService.logWastage(tx, txRecord.id, totalWastageValue);

                return updatedTx;
            }
        });
    }

    /**
     * Reject a pending wastage record
     */
    static async rejectWastage(wastageId: string, userId: string) {
        return await prisma.$transaction(async (tx: TransactionClient) => {
            
            const wastage = await tx.contractorWastage.findUnique({
                where: { id: wastageId }
            });

            if (wastage) {
                if (wastage.status !== 'PENDING') throw AppError.badRequest('ALREADY_PROCESSED');

                // Update Status to REJECTED
                
                const updated = await tx.contractorWastage.update({
                    where: { id: wastageId },
                    data: { 
                        status: 'REJECTED',
                        approvedById: userId,
                        approvedAt: new Date()
                    }
                });

                return updated;
            } else {
                // If not found in ContractorWastage, check InventoryTransaction for Store Wastage
                
                const txRecord = await tx.inventoryTransaction.findUnique({
                    where: { id: wastageId }
                });

                if (!txRecord || txRecord.type !== 'WASTAGE') {
                    throw AppError.badRequest('WASTAGE_NOT_FOUND');
                }

                if (!txRecord.notes?.includes('[STATUS: PENDING]')) {
                    throw AppError.badRequest('ALREADY_PROCESSED');
                }

                // Update the notes in the transaction to REJECTED
                const rejectedNotes = txRecord.notes.replace('[STATUS: PENDING]', '[STATUS: REJECTED]');
                
                const updatedTx = await tx.inventoryTransaction.update({
                    where: { id: txRecord.id },
                    data: {
                        notes: rejectedNotes,
                        userId
                    }
                });

                return updatedTx;
            }
        });
    }

    /**
     * Get consolidated wastage history for reporting
     */
    static async getWastageHistory(filters: { storeId?: string, contractorId?: string, month?: string }) {
        let dateFilter = {};
        if (filters.month) {
            const startOfMonth = new Date(`${filters.month}-01`);
            const endOfMonth = new Date(startOfMonth.getFullYear(), startOfMonth.getMonth() + 1, 1);
            dateFilter = { gte: startOfMonth, lt: endOfMonth };
        }

        const contractorWastage = await prisma.contractorWastage.findMany({
            where: {
                ...(filters.contractorId ? { contractorId: filters.contractorId } : {}),
                ...(filters.storeId ? { storeId: filters.storeId } : {}),
                ...(filters.month ? { createdAt: dateFilter } : {})
            },
            include: {
                contractor: { select: { name: true } },
                store: { select: { name: true } },
                items: { include: { item: { select: { name: true, code: true } } } }
            },
            orderBy: { createdAt: 'desc' }
        });

        const storeWastage = await prisma.inventoryTransaction.findMany({
            where: {
                type: 'WASTAGE',
                ...(filters.storeId ? { storeId: filters.storeId } : {}),
                ...(filters.month ? { date: dateFilter } : {})
            },
            include: {
                store: { select: { name: true } },
                items: { include: { item: { select: { name: true, code: true } } } }
            },
            orderBy: { date: 'desc' }
        });

        const history = [
            ...contractorWastage.map(w => ({
                id: w.id,
                date: w.createdAt,
                type: 'CONTRACTOR',
                entityName: w.contractor.name,
                storeName: w.store.name,
                month: w.month,
                description: w.description,
                status: w.status || 'APPROVED',
                items: w.items.map(i => ({ name: i.item.name, code: i.item.code, quantity: Number(i.quantity) }))
            })),
            ...storeWastage.map(w => ({
                id: w.id,
                date: w.date,
                type: 'STORE',
                entityName: 'N/A',
                storeName: w.store?.name || 'Unknown Store',
                month: w.date.toISOString().slice(0, 7),
                description: w.notes || '',
                status: w.notes?.includes('[STATUS: PENDING]') ? 'PENDING' : 'APPROVED',
                items: w.items.map(i => ({ name: i.item.name, code: i.item.code, quantity: Math.abs(Number(i.quantity)) }))
            }))
        ];

        return history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
}
