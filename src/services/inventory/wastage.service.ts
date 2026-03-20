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
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const wastage = await (tx as any).contractorWastage.create({
                    data: {
                        contractorId,
                        storeId,
                        month: month || new Date().toISOString().slice(0, 7),
                        description: description || reason,
                        items: {
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            create: items.map((item: any) => ({
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
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        await (tx as any).contractorBatchStock.update({
                            where: { contractorId_batchId: { contractorId, batchId: picked.batchId } },
                            data: { quantity: { decrement: picked.quantity } }
                        });
                    }

                    // B. Reduce Contractor Total Stock
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    await (tx as any).contractorStock.update({
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
            const transactionItems: { itemId: string; quantity: number }[] = [];

            for (const item of items) {
                const qty = StockService.round(parseFloat(item.quantity.toString()));
                if (qty <= 0) continue;

                // A. FIFO Deduction from Store Batches
                const pickedBatches = await StockService.pickStoreBatchesFIFO(tx, storeId, item.itemId, qty);
                for (const picked of pickedBatches) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    await (tx as any).inventoryBatchStock.update({
                        where: { storeId_batchId: { storeId, batchId: picked.batchId } },
                        data: { quantity: { decrement: picked.quantity } }
                    });
                }

                // B. Reduce Store Total Stock
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await (tx as any).inventoryStock.upsert({
                    where: { storeId_itemId: { storeId, itemId: item.itemId } },
                    update: { quantity: { decrement: qty } },
                    create: { storeId, itemId: item.itemId, quantity: -qty }
                });

                transactionItems.push({ itemId: item.itemId, quantity: -qty });
            }

            // Create Transaction Log
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const txRecord = await (tx as any).inventoryTransaction.create({
                data: {
                    type: 'WASTAGE',
                    storeId,
                    userId: userId || 'SYSTEM',
                    referenceId: `STORE-WASTAGE-${Date.now()}`,
                    notes: reason || description,
                    items: {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        create: transactionItems.map((ti: any) => ({
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

        // Map to common format
        const history = [
            ...contractorWastage.map(w => ({
                id: w.id,
                date: w.createdAt,
                type: 'CONTRACTOR',
                entityName: w.contractor.name,
                storeName: w.store.name,
                month: w.month,
                description: w.description,
                items: w.items.map(i => ({ name: i.item.name, code: i.item.code, quantity: i.quantity }))
            })),
            ...storeWastage.map((w: any) => ({
                id: w.id,
                date: w.date,
                type: 'STORE',
                entityName: 'N/A',
                storeName: w.store?.name || 'Unknown Store',
                month: w.date.toISOString().slice(0, 7),
                description: w.notes,
                items: w.items.map((i: any) => ({ name: i.item.name, code: i.item.code, quantity: Math.abs(i.quantity) }))
            }))
        ];

        return history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
}
