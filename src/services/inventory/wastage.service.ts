
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
        let totalWastageValue = 0;
        const excessDetails: string[] = [];

        for (const item of items) {
            const meta = itemMetas.find(m => m.id === item.itemId);
            if (!meta) continue;

            // Trigger approval flow if wastage is not generally allowed for this item
            if (!meta.isWastageAllowed) {
                requiresApproval = true;
            }

            // Calculate total financial value of the wastage
            const price = meta.costPrice ? Number(meta.costPrice) : (meta.unitPrice ? Number(meta.unitPrice) : 0);
            const qty = parseFloat(item.quantity.toString()) || 0;
            totalWastageValue += qty * price;

            // Validate wastage percentage limits for contractor issues
            if (contractorId) {
                const targetMonth = month || new Date().toISOString().slice(0, 7);
                const issues = await prisma.contractorMaterialIssue.findMany({
                    where: {
                        contractorId,
                        month: targetMonth
                    },
                    include: { items: true }
                });

                let totalIssued = 0;
                for (const issue of issues) {
                    const issueItem = issue.items.find(i => i.itemId === item.itemId);
                    if (issueItem) {
                        totalIssued += Number(issueItem.quantity);
                    }
                }

                const allowedPerc = meta.maxWastagePercentage ? Number(meta.maxWastagePercentage) : 0;
                if (totalIssued > 0) {
                    const wastagePerc = (qty / totalIssued) * 100;
                    if (wastagePerc > allowedPerc) {
                        requiresApproval = true;
                        excessDetails.push(`${meta.name} (Wastage: ${wastagePerc.toFixed(1)}% > Allowed: ${allowedPerc.toFixed(1)}%)`);
                    }
                } else if (qty > 0) {
                    requiresApproval = true;
                    excessDetails.push(`${meta.name} (Wastage reported but no issues recorded)`);
                }
            }
        }

        // Value-based approval threshold (e.g. 10,000 LKR)
        const VALUE_APPROVAL_THRESHOLD = 10000;
        if (totalWastageValue > VALUE_APPROVAL_THRESHOLD) {
            requiresApproval = true;
        }

        // Contractors must NEVER get automatic approval (strict anti-fraud compliance check)
        if (contractorId) {
            requiresApproval = true;
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
                        description: excessDetails.length > 0
                            ? `[EXCESS_WASTAGE: ${excessDetails.join(', ')}] ${description || reason || ''}`
                            : (description || reason),
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
            const transactionItems: { itemId: string; quantity: number; batchId: string | null }[] = [];

            for (const item of items) {
                const qty = StockService.round(parseFloat(item.quantity.toString()));
                if (qty <= 0) continue;

                if (status === 'APPROVED') {
                    const pickedBatches = await StockService.pickStoreBatchesFIFO(tx, storeId, item.itemId, qty);
                    for (const picked of pickedBatches) {
                        if (picked.batchId) {
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            await (tx as any).inventoryBatchStock.update({
                                where: { storeId_batchId: { storeId, batchId: picked.batchId } },
                                data: { quantity: { decrement: picked.quantity } }
                            });
                        }
                        transactionItems.push({
                            itemId: item.itemId,
                            quantity: -picked.quantity,
                            batchId: picked.batchId
                        });
                    }

                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    await (tx as any).inventoryStock.upsert({
                        where: { storeId_itemId: { storeId, itemId: item.itemId } },
                        update: { quantity: { decrement: qty } },
                        create: { storeId, itemId: item.itemId, quantity: -qty }
                    });
                } else {
                    transactionItems.push({
                        itemId: item.itemId,
                        quantity: -qty,
                        batchId: null
                    });
                }
            }

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
                            quantity: ti.quantity,
                            batchId: ti.batchId
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

            if (wastage) {
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
            } else {
                // If not found in ContractorWastage, check InventoryTransaction for Store Wastage
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const txRecord = await (tx as any).inventoryTransaction.findUnique({
                    where: { id: wastageId },
                    include: { items: true }
                });

                if (!txRecord || txRecord.type !== 'WASTAGE') {
                    throw new Error('WASTAGE_NOT_FOUND');
                }

                if (!txRecord.notes?.includes('[STATUS: PENDING]')) {
                    throw new Error('ALREADY_PROCESSED');
                }

                // Apply deductions for store wastage
                for (const item of txRecord.items) {
                    const qty = StockService.round(Math.abs(item.quantity));
                    if (qty <= 0) continue;

                    const pickedBatches = await StockService.pickStoreBatchesFIFO(tx, txRecord.storeId, item.itemId, qty);

                    // Delete the pending log item and recreate it split by batchIds
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    await (tx as any).inventoryTransactionItem.delete({
                        where: { id: item.id }
                    });

                    for (const picked of pickedBatches) {
                        if (picked.batchId) {
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            await (tx as any).inventoryBatchStock.update({
                                where: { storeId_batchId: { storeId: txRecord.storeId, batchId: picked.batchId } },
                                data: { quantity: { decrement: picked.quantity } }
                            });
                        }

                        // Recreate the transaction item with batch association
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        await (tx as any).inventoryTransactionItem.create({
                            data: {
                                transactionId: txRecord.id,
                                itemId: item.itemId,
                                quantity: -picked.quantity,
                                batchId: picked.batchId
                            }
                        });
                    }

                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    await (tx as any).inventoryStock.upsert({
                        where: { storeId_itemId: { storeId: txRecord.storeId, itemId: item.itemId } },
                        update: { quantity: { decrement: qty } },
                        create: { storeId: txRecord.storeId, itemId: item.itemId, quantity: -qty }
                    });
                }

                // Update the notes in the transaction to APPROVED
                const approvedNotes = txRecord.notes.replace('[STATUS: PENDING]', '[STATUS: APPROVED]');
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const updatedTx = await (tx as any).inventoryTransaction.update({
                    where: { id: txRecord.id },
                    data: {
                        notes: approvedNotes,
                        userId
                    }
                });

                return updatedTx;
            }
        });
    }

    /**
     * Reject a pending wastage record
     */
    static async rejectWastage(wastageId: string, userId: string) {
        return await prisma.$transaction(async (tx: TransactionClient) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const wastage = await (tx as any).contractorWastage.findUnique({
                where: { id: wastageId }
            });

            if (wastage) {
                if (wastage.status !== 'PENDING') throw new Error('ALREADY_PROCESSED');

                // Update Status to REJECTED
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const updated = await (tx as any).contractorWastage.update({
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
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const txRecord = await (tx as any).inventoryTransaction.findUnique({
                    where: { id: wastageId }
                });

                if (!txRecord || txRecord.type !== 'WASTAGE') {
                    throw new Error('WASTAGE_NOT_FOUND');
                }

                if (!txRecord.notes?.includes('[STATUS: PENDING]')) {
                    throw new Error('ALREADY_PROCESSED');
                }

                // Update the notes in the transaction to REJECTED
                const rejectedNotes = txRecord.notes.replace('[STATUS: PENDING]', '[STATUS: REJECTED]');
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const updatedTx = await (tx as any).inventoryTransaction.update({
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
