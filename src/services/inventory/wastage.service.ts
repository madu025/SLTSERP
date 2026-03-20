
import { prisma } from '@/lib/prisma';
import { StockService } from './stock.service';
import { AuditService } from '../audit.service';
import { TransactionClient } from './types';

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
        const itemMetas = await prisma.inventoryItem.findMany({
            where: { id: { in: items.map(i => i.itemId) } }
        });

        let requiresApproval = false;
        for (const item of items) {
            const meta = itemMetas.find(m => m.id === item.itemId);
            if (!meta) continue;

            // Trigger approval flow if wastage is not generally allowed for this item
            if (!meta.isWastageAllowed) {
                requiresApproval = true;
                break;
            }

            // Optional: Percentage check could be added here if we had total issued data
            // For now, respect the isWastageAllowed flag
        }

        const status = requiresApproval ? 'PENDING' : 'APPROVED';

        // SCENARIO 1: Contractor Wastage
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
                        status: status,
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

                // 2. Only deduct stock if status is APPROVED
                if (status === 'APPROVED') {
                    for (const item of items) {
                        const qty = StockService.round(parseFloat(item.quantity.toString()));
                        if (qty <= 0) continue;

                        const pickedBatches = await StockService.pickContractorBatchesFIFO(tx, contractorId, item.itemId, qty);
                        for (const picked of pickedBatches) {
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            await (tx as any).contractorBatchStock.update({
                                where: { contractorId_batchId: { contractorId, batchId: picked.batchId } },
                                data: { quantity: { decrement: picked.quantity } }
                            });
                        }

                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        await (tx as any).contractorStock.update({
                            where: { contractorId_itemId: { contractorId, itemId: item.itemId } },
                            data: { quantity: { decrement: qty } }
                        });
                    }
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
            });
        }

        // SCENARIO 2: Store Wastage
        if (!storeId) throw new Error('STORE_ID_REQUIRED_FOR_STORE_WASTAGE');

        return await prisma.$transaction(async (tx: TransactionClient) => {
            const transactionItems: { itemId: string; quantity: number }[] = [];
            const qtyMap: Record<string, number> = {};

            for (const item of items) {
                const qty = StockService.round(parseFloat(item.quantity.toString()));
                if (qty <= 0) continue;
                qtyMap[item.itemId] = qty;

                if (status === 'APPROVED') {
                    const pickedBatches = await StockService.pickStoreBatchesFIFO(tx, storeId, item.itemId, qty);
                    for (const picked of pickedBatches) {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        await (tx as any).inventoryBatchStock.update({
                            where: { storeId_batchId: { storeId, batchId: picked.batchId } },
                            data: { quantity: { decrement: picked.quantity } }
                        });
                    }

                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    await (tx as any).inventoryStock.upsert({
                        where: { storeId_itemId: { storeId, itemId: item.itemId } },
                        update: { quantity: { decrement: qty } },
                        create: { storeId, itemId: item.itemId, quantity: -qty }
                    });
                }

                transactionItems.push({ itemId: item.itemId, quantity: -qty });
            }

            // Note: Currently Store Wastage doesn't have a 'status' in Transaction log, 
            // but we can add notes.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const txRecord = await (tx as any).inventoryTransaction.create({
                data: {
                    type: 'WASTAGE',
                    storeId,
                    userId: userId || 'SYSTEM',
                    referenceId: `STORE-WASTAGE-${Date.now()}`,
                    notes: `[STATUS: ${status}] ${reason || description}`,
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

            return { ...txRecord, status };
        });
    }

    /**
     * Approve a pending wastage record
     */
    static async approveWastage(wastageId: string, userId: string) {
        return await prisma.$transaction(async (tx: TransactionClient) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const wastage = await (tx as any).contractorWastage.findUnique({
                where: { id: wastageId },
                include: { items: true }
            });

            if (!wastage) throw new Error('WASTAGE_NOT_FOUND');
            if (wastage.status !== 'PENDING') throw new Error('ALREADY_PROCESSED');

            // Apply DEDUCTIONS
            for (const item of wastage.items) {
                const qty = StockService.round(item.quantity);
                if (qty <= 0) continue;

                const pickedBatches = await StockService.pickContractorBatchesFIFO(tx, wastage.contractorId, item.itemId, qty);
                for (const picked of pickedBatches) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    await (tx as any).contractorBatchStock.update({
                        where: { contractorId_batchId: { contractorId: wastage.contractorId, batchId: picked.batchId } },
                        data: { quantity: { decrement: picked.quantity } }
                    });
                }

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await (tx as any).contractorStock.update({
                    where: { contractorId_itemId: { contractorId: wastage.contractorId, itemId: item.itemId } },
                    data: { quantity: { decrement: qty } }
                });
            }

            // Update Status
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const updated = await (tx as any).contractorWastage.update({
                where: { id: wastageId },
                data: { 
                    status: 'APPROVED',
                    approvedById: userId,
                    approvedAt: new Date()
                }
            });

            return updated;
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
                status: (w as any).status || 'APPROVED',
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
                status: w.notes?.includes('[STATUS: PENDING]') ? 'PENDING' : 'APPROVED',
                items: w.items.map((i: any) => ({ name: i.item.name, code: i.item.code, quantity: Math.abs(i.quantity) }))
            }))
        ];

        return history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }
}
