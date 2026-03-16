import { prisma } from '@/lib/prisma';
import { StockRequest, Prisma } from '@prisma/client';
import { NotificationPolicyService } from '../notification/notification-policy.service';
import { emitSystemEvent } from '@/lib/events';
import { StockService } from './stock.service';
import { StockRequestActionData, TransactionClient } from './types';

export class StockRequestService {
    private static generateRequestId(): string {
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const random = Math.floor(1000 + Math.random() * 9000);
        return `REQ-${year}${month}${day}-${random}`;
    }

    static async createStockRequest(data: {
        fromStoreId: string;
        requestedById: string;
        items: { itemId: string; requestedQty: string | number; remarks?: string; make?: string; model?: string; suggestedVendor?: string }[];
        toStoreId?: string;
        priority?: string;
        requiredDate?: string;
        purpose?: string;
        sourceType?: string;
        projectTypes?: string[];
        maintenanceMonths?: string;
        irNumber?: string;
    }): Promise<StockRequest> {
        const { fromStoreId, toStoreId, requestedById, items, priority, requiredDate, purpose, sourceType, projectTypes, maintenanceMonths, irNumber } = data;

        const fromStore = await prisma.inventoryStore.findUnique({
            where: { id: fromStoreId },
            include: { opmcs: { select: { id: true } } }
        });
        if (!fromStore) throw new Error("INVALID_STORE");

        let finalToStoreId = toStoreId;

        if (fromStore.type === 'SUB') {
            if (sourceType === 'SLT') {
                throw new Error("SUB_STORE_CANNOT_REQUEST_SLT");
            }

            if (sourceType !== 'LOCAL_PURCHASE' && !toStoreId) {
                const mainStore = await prisma.inventoryStore.findFirst({ where: { type: 'MAIN' } });
                if (mainStore) finalToStoreId = mainStore.id;
            }
        }

        const initialWorkflowStage = fromStore.type === 'SUB' ? 'ARM_APPROVAL' : 'OSP_MANAGER_APPROVAL';

        const req = await prisma.stockRequest.create({
            data: {
                requestNr: this.generateRequestId(),
                fromStoreId,
                toStoreId: finalToStoreId,
                requestedById,
                status: 'PENDING',
                priority: priority || 'MEDIUM',
                requiredDate: requiredDate ? new Date(requiredDate) : null,
                purpose: purpose || null,
                sourceType: sourceType || 'SLT',
                workflowStage: initialWorkflowStage,
                projectTypes: projectTypes || [],
                maintenanceMonths: maintenanceMonths || null,
                irNumber: irNumber || null,
                items: {
                    create: items.map((i) => ({
                        itemId: i.itemId,
                        requestedQty: parseFloat(i.requestedQty.toString()),
                        remarks: i.remarks || null,
                        make: i.make || null,
                        model: i.model || null,
                        suggestedVendor: i.suggestedVendor || null
                    }))
                }
            }
        });

        try {
            await NotificationPolicyService.notifyStockRequestCreated({
                id: req.id,
                requestNr: req.requestNr,
                fromStoreName: fromStore.name,
                opmcId: fromStore.opmcs?.[0]?.id,
                type: req.sourceType
            }, initialWorkflowStage);
        } catch (nErr) {
            console.error("Failed to send stock request notification:", nErr);
        }

        return req;
    }

    static async getStockRequests(filters: {
        storeId?: string;
        isApprover?: boolean;
        status?: string;
        workflowStage?: string;
    }) {
        const where: Prisma.StockRequestWhereInput = {};

        if (filters.storeId) {
            if (filters.isApprover) {
                where.toStoreId = filters.storeId;
            } else {
                where.fromStoreId = filters.storeId;
            }
        }

        if (filters.status) {
            const statuses = filters.status.split(',');
            where.status = { in: statuses };
        }

        if (filters.workflowStage) {
            where.workflowStage = { in: filters.workflowStage.split(',') };
        }

        return await prisma.stockRequest.findMany({
            where,
            include: {
                fromStore: true,
                toStore: true,
                requestedBy: true,
                items: { include: { item: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
    }

    static async processStockRequestAction(data: StockRequestActionData) {
        const { requestId, action, userId, remarks, items } = data;

        // 1. ARM_APPROVE
        if (action === 'ARM_APPROVE') {
            const updated = await prisma.stockRequest.update({
                where: { id: requestId },
                data: {
                    workflowStage: 'STORES_MANAGER_APPROVAL',
                    armAction: 'APPROVED',
                    armDate: new Date(),
                    armApprovedById: userId,
                    armRemarks: remarks
                }
            });

            try {
                await NotificationPolicyService.notifyStockRequestStageChange(
                    { id: updated.id, requestNr: updated.requestNr },
                    'STORES_MANAGER_APPROVAL',
                    ['STORES_MANAGER']
                );
            } catch (nErr) {
                console.error("Failed to notify Stores Manager:", nErr);
            }
            return updated;
        }

        // 2. ARM_REJECT (RETURNED)
        if (action === 'RETURN') {
            const updated = await prisma.stockRequest.update({
                where: { id: requestId },
                data: {
                    workflowStage: 'RETURNED',
                    status: 'RETURNED',
                    armAction: 'REJECTED',
                    armDate: new Date(),
                    armApprovedById: userId,
                    armRemarks: remarks
                }
            });

            try {
                await NotificationPolicyService.notifyStockRequestFinalAction(
                    { id: updated.id, requestNr: updated.requestNr, requestedById: updated.requestedById },
                    'RETURNED',
                    remarks
                );
            } catch (nErr) {
                console.error("Failed to notify requester:", nErr);
            }
            return updated;
        }

        // 3. STORES_MANAGER_APPROVE
        if (action === 'STORES_MANAGER_APPROVE') {
            const updated = await prisma.stockRequest.update({
                where: { id: requestId },
                data: {
                    workflowStage: 'OSP_MANAGER_APPROVAL',
                    storesManagerAction: 'APPROVED',
                    storesManagerDate: new Date(),
                    storesManagerApprovedById: userId,
                    storesManagerRemarks: remarks
                }
            });

            try {
                await NotificationPolicyService.notifyStockRequestStageChange(
                    { id: updated.id, requestNr: updated.requestNr },
                    'OSP_MANAGER_APPROVAL',
                    ['OSP_MANAGER']
                );
            } catch (nErr) {
                console.error("Failed to notify OSP Manager:", nErr);
            }
            return updated;
        }

        // 4. REJECT
        if (action === 'REJECT') {
            const updated = await prisma.stockRequest.update({
                where: { id: requestId },
                data: {
                    status: 'REJECTED',
                    approvedById: userId,
                    remarks: remarks || null
                }
            });

            try {
                await NotificationPolicyService.notifyStockRequestFinalAction(
                    { id: updated.id, requestNr: updated.requestNr, requestedById: updated.requestedById },
                    'REJECTED'
                );
            } catch (nErr) {
                console.error("Failed to notify rejection:", nErr);
            }
            return updated;
        }

        // 5. OSP_MANAGER_APPROVE
        if (action === 'APPROVE') {
            return await prisma.$transaction(async (tx: TransactionClient) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const stockReq = await (tx as any).stockRequest.findUnique({
                    where: { id: requestId },
                    include: { items: true, fromStore: true, toStore: true }
                });

                if (!stockReq) throw new Error("REQUEST_NOT_FOUND");

                if (items && Array.isArray(items)) {
                    for (const item of items) {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        await (tx as any).stockRequestItem.update({
                            where: { id: item.id },
                            data: { approvedQty: item.approvedQty || 0 }
                        });
                    }
                }

                let nextWorkflowStage = 'PROCUREMENT';
                const nextStatus = 'APPROVED';
                let rolesToNotify = ['STORES_MANAGER'];
                if (stockReq.sourceType === 'MAIN_STORE' && stockReq.toStoreId) {
                    nextWorkflowStage = 'MAIN_STORE_RELEASE';
                    rolesToNotify = ['STORES_ASSISTANT'];
                } else if (stockReq.sourceType === 'SLT') {
                    nextWorkflowStage = 'GRN_PENDING';
                }

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const updated = await (tx as any).stockRequest.update({
                    where: { id: requestId },
                    data: {
                        status: nextStatus,
                        workflowStage: nextWorkflowStage,
                        approvedById: userId,
                        managerAction: 'APPROVED',
                        managerDate: new Date(),
                        remarks: remarks || null
                    }
                });

                try {
                    await NotificationPolicyService.notifyStockRequestStageChange(
                        { id: updated.id, requestNr: updated.requestNr },
                        nextWorkflowStage,
                        rolesToNotify
                    );
                } catch (nErr) {
                    console.error("Failed to notify next step:", nErr);
                }

                return updated;
            });
        }

        // 6. PROCUREMENT_COMPLETE
        if (action === 'PROCUREMENT_COMPLETE') {
            const updated = await prisma.stockRequest.update({
                where: { id: requestId },
                data: {
                    workflowStage: 'GRN_PENDING',
                    status: 'APPROVED',
                    procurementStatus: 'COMPLETED',
                    remarks: remarks || undefined
                }
            });

            try {
                await NotificationPolicyService.notifyStockRequestFinalAction(
                    { id: updated.id, requestNr: updated.requestNr, requestedById: updated.requestedById },
                    'PROCUREMENT_COMPLETE'
                );
            } catch (nErr) {
                console.error("Failed to notify procurement complete:", nErr);
            }
            return updated;
        }

        // 7. MAIN_STORE_RELEASE
        if (action === 'RELEASE') {
            return await prisma.$transaction(async (tx: TransactionClient) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const stockReq = await (tx as any).stockRequest.findUnique({
                    where: { id: requestId },
                    include: { items: true, fromStore: true }
                });

                if (!stockReq) throw new Error("REQUEST_NOT_FOUND");
                if (stockReq.workflowStage !== 'MAIN_STORE_RELEASE') throw new Error("INVALID_WORKFLOW_STAGE");

                for (const item of items || []) {
                    const issuedQty = StockService.round(item.issuedQty || 0);
                    if (issuedQty <= 0) continue;

                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const reqItem = stockReq.items.find((i: any) => i.id === item.id);
                    if (!reqItem) continue;

                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    await (tx as any).stockRequestItem.update({
                        where: { id: reqItem.id },
                        data: { issuedQty }
                    });

                    const pickedBatches = await StockService.pickStoreBatchesFIFO(tx, stockReq.toStoreId!, reqItem.itemId, issuedQty);

                    for (const picked of pickedBatches) {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        await (tx as any).inventoryBatchStock.update({
                            where: { storeId_batchId: { storeId: stockReq.toStoreId!, batchId: picked.batchId } },
                            data: { quantity: { decrement: picked.quantity } }
                        });
                    }

                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    await (tx as any).inventoryStock.update({
                        where: { storeId_itemId: { storeId: stockReq.toStoreId!, itemId: reqItem.itemId } },
                        data: { quantity: { decrement: issuedQty } }
                    });

                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    await (tx as any).inventoryTransaction.create({
                        data: {
                            type: 'TRANSFER_OUT',
                            storeId: stockReq.toStoreId!,
                            referenceId: stockReq.requestNr,
                            userId: userId || 'SYSTEM',
                            notes: `Released to ${stockReq.fromStore?.name} - Request ${stockReq.requestNr}`,
                            items: {
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                create: pickedBatches.map((p: any) => ({
                                    itemId: reqItem.itemId,
                                    batchId: p.batchId,
                                    quantity: -p.quantity
                                }))
                            }
                        }
                    });
                }

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const updated = await (tx as any).stockRequest.update({
                    where: { id: requestId },
                    data: {
                        workflowStage: 'SUB_STORE_RECEIVE',
                        releasedById: userId,
                        releasedDate: new Date(),
                        releasedRemarks: remarks
                    }
                });

                try {
                    await NotificationPolicyService.notifyStockRequestFinalAction(
                        { id: updated.id, requestNr: updated.requestNr, requestedById: updated.requestedById },
                        'RELEASED'
                    );
                } catch (nErr) {
                    console.error("Failed to notify materials release:", nErr);
                }

                return updated;
            });
        }

        // 8. RECEIVE
        if (action === 'RECEIVE') {
            return await prisma.$transaction(async (tx: TransactionClient) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const stockReq = await (tx as any).stockRequest.findUnique({
                    where: { id: requestId },
                    include: { items: true }
                });

                if (!stockReq) throw new Error("REQUEST_NOT_FOUND");
                if (stockReq.workflowStage !== 'SUB_STORE_RECEIVE') throw new Error("INVALID_WORKFLOW_STAGE");

                let totalIssued = 0;
                let totalReceived = 0;

                for (const item of items || []) {
                    const receivedQty = StockService.round(item.receivedQty || 0);
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const reqItem = stockReq.items.find((i: any) => i.id === item.id);

                    if (!reqItem) continue;
                    if (receivedQty <= 0) continue;

                    totalIssued += StockService.round(reqItem.issuedQty || 0);
                    totalReceived += receivedQty;

                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    await (tx as any).stockRequestItem.update({
                        where: { id: reqItem.id },
                        data: { receivedQty }
                    });

                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const movements = await (tx as any).inventoryTransactionItem.findMany({
                        where: {
                            transaction: {
                                referenceId: stockReq.requestNr,
                                type: 'TRANSFER_OUT',
                                storeId: stockReq.toStoreId!
                            },
                            itemId: reqItem.itemId
                        }
                    });

                    const transactionItems: { itemId: string; batchId: string; quantity: number }[] = [];
                    let remainingToReceive = receivedQty;

                    for (const m of movements) {
                        if (remainingToReceive <= 0) break;
                        const issuedForThisBatch = Math.abs(m.quantity);
                        const take = Math.min(issuedForThisBatch, remainingToReceive);
                        const batchId = m.batchId;

                        if (!batchId) continue;

                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        await (tx as any).inventoryBatchStock.upsert({
                            where: { storeId_batchId: { storeId: stockReq.fromStoreId!, batchId } },
                            update: { quantity: { increment: take } },
                            create: {
                                storeId: stockReq.fromStoreId!,
                                batchId,
                                itemId: reqItem.itemId,
                                quantity: take
                            }
                        });

                        transactionItems.push({ itemId: reqItem.itemId, batchId, quantity: take });
                        remainingToReceive = StockService.round(remainingToReceive - take);
                    }

                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    await (tx as any).inventoryStock.upsert({
                        where: { storeId_itemId: { storeId: stockReq.fromStoreId!, itemId: reqItem.itemId } },
                        update: { quantity: { increment: receivedQty } },
                        create: { storeId: stockReq.fromStoreId!, itemId: reqItem.itemId, quantity: receivedQty }
                    });

                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    await (tx as any).inventoryTransaction.create({
                        data: {
                            type: 'TRANSFER_IN',
                            storeId: stockReq.fromStoreId!,
                            referenceId: stockReq.requestNr,
                            userId: userId || 'SYSTEM',
                            notes: `Received from Main Store - Request ${stockReq.requestNr}`,
                            items: {
                                create: transactionItems
                            }
                        }
                    });
                }

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const updated = await (tx as any).stockRequest.update({
                    where: { id: requestId },
                    data: {
                        status: totalReceived >= totalIssued ? 'COMPLETED' : 'PARTIALLY_COMPLETED',
                        workflowStage: 'COMPLETED',
                        receivedById: userId,
                        receivedDate: new Date(),
                        receivedRemarks: remarks
                    }
                });

                emitSystemEvent('INVENTORY_UPDATE');
                return updated;
            });
        }

        throw new Error('INVALID_ACTION');
    }
}
