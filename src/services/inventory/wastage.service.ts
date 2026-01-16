import { prisma } from '@/lib/prisma';
import { StockService } from './stock.service';
import { AuditService } from '../audit.service';
import { TransactionClient } from './types';

export class WastageService {
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

        // SCENARIO 1: Contractor Wastage (Reduce Contractor Stock)
        if (contractorId) {
            if (!storeId) throw new Error('STORE_ID_REQUIRED');

            return await prisma.$transaction(async (tx: TransactionClient) => {
                const wastage = await tx.contractorWastage.create({
                    data: {
                        contractorId,
                        storeId,
                        month: month || new Date().toISOString().slice(0, 7),
                        description: description || reason,
                        items: {
                            create: items.map((item) => ({
                                itemId: item.itemId,
                                quantity: parseFloat(item.quantity.toString()),
                                unit: item.unit || 'Nos'
                            }))
                        }
                    }
                });

                for (const item of items) {
                    const qty = StockService.round(parseFloat(item.quantity.toString()));
                    if (qty <= 0) continue;

                    // A. FIFO Deduction from Contractor Batches
                    const pickedBatches = await StockService.pickContractorBatchesFIFO(tx, contractorId, item.itemId, qty);
                    for (const picked of pickedBatches) {
                        await tx.contractorBatchStock.update({
                            where: { contractorId_batchId: { contractorId, batchId: picked.batchId } },
                            data: { quantity: { decrement: picked.quantity } }
                        });
                    }

                    // B. Reduce Contractor Total Stock
                    await tx.contractorStock.update({
                        where: { contractorId_itemId: { contractorId, itemId: item.itemId } },
                        data: { quantity: { decrement: qty } }
                    });
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

                return { success: true, message: 'Contractor wastage recorded', id: wastage.id };
            });
        }

        if (!storeId) throw new Error('STORE_ID_REQUIRED_FOR_STORE_WASTAGE');

        // SCENARIO 2: Store Wastage (Reduce Store Stock)
        return await prisma.$transaction(async (tx: TransactionClient) => {
            const transactionItems = [];

            for (const item of items) {
                const qty = StockService.round(parseFloat(item.quantity.toString()));
                if (qty <= 0) continue;

                // A. FIFO Deduction from Store Batches
                const pickedBatches = await StockService.pickStoreBatchesFIFO(tx, storeId, item.itemId, qty);
                for (const picked of pickedBatches) {
                    await tx.inventoryBatchStock.update({
                        where: { storeId_batchId: { storeId, batchId: picked.batchId } },
                        data: { quantity: { decrement: picked.quantity } }
                    });
                }

                // B. Reduce Store Total Stock
                await tx.inventoryStock.upsert({
                    where: { storeId_itemId: { storeId, itemId: item.itemId } },
                    update: { quantity: { decrement: qty } },
                    create: { storeId, itemId: item.itemId, quantity: -qty }
                });

                transactionItems.push({ itemId: item.itemId, quantity: -qty });
            }

            // Create Transaction Log
            const txRecord = await tx.inventoryTransaction.create({
                data: {
                    type: 'WASTAGE',
                    storeId,
                    userId: userId || 'SYSTEM',
                    referenceId: `STORE-WASTAGE-${Date.now()}`,
                    notes: reason || description,
                    items: {
                        create: transactionItems.map((ti) => ({
                            itemId: ti.itemId,
                            quantity: ti.quantity
                        }))
                    }
                }
            });

            if (userId) {
                await AuditService.log({
                    userId,
                    action: 'RECORD_STORE_WASTAGE',
                    entity: 'InventoryTransaction',
                    entityId: txRecord.id,
                    newValue: txRecord
                });
            }

            return txRecord;
        });
    }
}
