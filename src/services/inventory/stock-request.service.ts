import { StockRequest, Prisma, StockRequestItem } from '@prisma/client';
import { StockRequestRepository } from '@/repositories/stock-request.repository';
import { InventoryRepository } from '@/repositories/inventory.repository';
import { emitSystemEvent } from '@/lib/events';
import { eventBus } from '@/lib/events/event-bus';
import { StockService } from './stock.service';
import { StockRequestActionData, TransactionClient } from './types';
import { prisma } from '@/lib/prisma';

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

        const fromStore = await InventoryRepository.findStoreById(fromStoreId);
        if (!fromStore) throw new Error("INVALID_STORE");

        let finalToStoreId = toStoreId;

        if (fromStore.type === 'SUB') {
            if (sourceType === 'SLT') {
                throw new Error("SUB_STORE_CANNOT_REQUEST_SLT");
            }

            if (sourceType !== 'LOCAL_PURCHASE' && !toStoreId) {
                const mainStore = await InventoryRepository.findMainStore(); 
                if (mainStore) finalToStoreId = mainStore.id;
            }
        }

        const initialWorkflowStage = fromStore.type === 'SUB' ? 'ARM_APPROVAL' : 'OSP_MANAGER_APPROVAL';

        const req = await StockRequestRepository.create({
            requestNr: StockRequestService.generateRequestId(),
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
        });

        try {
            await eventBus.publish('inventory.stock_request_created', {
                request: {
                    id: req.id,
                    requestNr: req.requestNr,
                    fromStoreName: fromStore.name,
                    opmcId: fromStore.opmcs?.[0]?.id,
                    type: req.sourceType
                },
                stage: initialWorkflowStage
            });
        } catch (nErr) {
            console.error("Failed to publish stock request created event:", nErr);
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

        return await StockRequestRepository.findMany({
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

    /**
     * Main action dispatcher for Stock Requests
     */
    static async processStockRequestAction(data: StockRequestActionData) {
        const { action, requestId, userId } = data;

        // Segregation of Duties (SoD) enforcement: Request creator cannot approve/release/process their own request
        if (['ARM_APPROVE', 'STORES_MANAGER_APPROVE', 'APPROVE', 'RELEASE'].includes(action)) {
            const stockReq = await prisma.stockRequest.findUnique({
                where: { id: requestId },
                select: { requestedById: true }
            });
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { role: true }
            });
            if (user?.role !== 'SUPER_ADMIN' && stockReq && stockReq.requestedById === userId) {
                throw new Error("SEGREGATION_OF_DUTIES_VIOLATION: Request creator cannot approve or release this stock request.");
            }
        }

        switch (action) {
            case 'ARM_APPROVE':
                return this.handleArmApproval(data);
            case 'RETURN':
                return this.handleReturn(data);
            case 'STORES_MANAGER_APPROVE':
                return this.handleStoresManagerApproval(data);
            case 'REJECT':
                return this.handleReject(data);
            case 'APPROVE':
                return this.handleOspManagerApproval(data);
            case 'PROCUREMENT_COMPLETE':
                return this.handleProcurementComplete(data);
            case 'RELEASE':
                return this.handleMainStoreRelease(data);
            case 'RECEIVE':
                return this.handleSubStoreReceive(data);
            default:
                throw new Error('INVALID_ACTION');
        }
    }

    private static async handleArmApproval(data: StockRequestActionData) {
        const { requestId, userId, remarks } = data;
        const updated = await StockRequestRepository.update(requestId, {
            workflowStage: 'STORES_MANAGER_APPROVAL',
            armAction: 'APPROVED',
            armDate: new Date(),
            armApprovedById: userId,
            armRemarks: remarks
        });

        this.safeNotifyStageChange(updated, 'STORES_MANAGER_APPROVAL', ['STORES_MANAGER']);
        return updated;
    }

    private static async handleReturn(data: StockRequestActionData) {
        const { requestId, userId, remarks } = data;
        const updated = await StockRequestRepository.update(requestId, {
            workflowStage: 'RETURNED',
            status: 'RETURNED',
            armAction: 'REJECTED',
            armDate: new Date(),
            armApprovedById: userId,
            armRemarks: remarks
        });

        this.safeNotifyFinalAction(updated, 'RETURNED', remarks);
        return updated;
    }

    private static async handleStoresManagerApproval(data: StockRequestActionData) {
        const { requestId, userId, remarks } = data;
        const updated = await StockRequestRepository.update(requestId, {
            workflowStage: 'OSP_MANAGER_APPROVAL',
            storesManagerAction: 'APPROVED',
            storesManagerDate: new Date(),
            storesManagerApprovedById: userId,
            storesManagerRemarks: remarks
        });

        this.safeNotifyStageChange(updated, 'OSP_MANAGER_APPROVAL', ['OSP_MANAGER']);
        return updated;
    }

    private static async handleReject(data: StockRequestActionData) {
        const { requestId, userId, remarks } = data;
        const updated = await StockRequestRepository.update(requestId, {
            status: 'REJECTED',
            approvedById: userId,
            remarks: remarks || null
        });

        this.safeNotifyFinalAction(updated, 'REJECTED');
        return updated;
    }

    private static async handleOspManagerApproval(data: StockRequestActionData) {
        const { requestId, userId, remarks, items } = data;
        return await prisma.$transaction(async (tx: TransactionClient) => {
            const stockReq = await StockRequestRepository.findById(requestId, { items: true, fromStore: true, toStore: true }, tx);
            if (!stockReq) throw new Error("REQUEST_NOT_FOUND");

            if (items && Array.isArray(items)) {
                for (const item of items) {
                    await StockRequestRepository.updateItem(item.id, { approvedQty: item.approvedQty || 0 }, tx);
                }
            }

            let nextWorkflowStage = 'PROCUREMENT';
            let rolesToNotify = ['STORES_MANAGER'];
            if (stockReq.sourceType === 'MAIN_STORE' && stockReq.toStoreId) {
                nextWorkflowStage = 'MAIN_STORE_RELEASE';
                rolesToNotify = ['STORES_ASSISTANT'];
            } else if (stockReq.sourceType === 'SLT') {
                nextWorkflowStage = 'GRN_PENDING';
            }

            const updated = await StockRequestRepository.update(requestId, {
                status: 'APPROVED',
                workflowStage: nextWorkflowStage,
                approvedById: userId,
                managerAction: 'APPROVED',
                managerDate: new Date(),
                remarks: remarks || null
            }, tx);

            this.safeNotifyStageChange(updated, nextWorkflowStage, rolesToNotify);
            return updated;
        });
    }

    private static async handleProcurementComplete(data: StockRequestActionData) {
        const { requestId, remarks } = data;
        const updated = await StockRequestRepository.update(requestId, {
            workflowStage: 'GRN_PENDING',
            status: 'APPROVED',
            procurementStatus: 'COMPLETED',
            remarks: remarks || undefined
        });

        this.safeNotifyFinalAction(updated, 'PROCUREMENT_COMPLETE');
        return updated;
    }

    private static async getOrCreateTransitStore(tx: TransactionClient): Promise<string> {
        const prismaTx = tx as unknown as typeof prisma;
        let transit = await prismaTx.inventoryStore.findFirst({
            where: { type: 'TRANSIT' }
        });

        if (!transit) {
            transit = await prismaTx.inventoryStore.create({
                data: {
                    name: 'Central Transit Store',
                    type: 'TRANSIT',
                    location: 'In-Transit'
                }
            });
        }
        return transit.id;
    }

    private static async handleMainStoreRelease(data: StockRequestActionData) {
        const { requestId, userId, remarks, items } = data;
        return await prisma.$transaction(async (tx: TransactionClient) => {
            const stockReq = await StockRequestRepository.findById(requestId, { items: true, fromStore: true }, tx) as Prisma.StockRequestGetPayload<{
                include: { items: true, fromStore: true }
            }> | null;

            if (!stockReq) throw new Error("REQUEST_NOT_FOUND");
            if (stockReq.workflowStage !== 'MAIN_STORE_RELEASE') throw new Error("INVALID_WORKFLOW_STAGE");

            const transitStoreId = await this.getOrCreateTransitStore(tx);
            const prismaTx = tx as unknown as typeof prisma;

            for (const item of items || []) {
                const issuedQty = StockService.round(item.issuedQty || 0);
                if (issuedQty <= 0) continue;

                const reqItem = stockReq.items.find((i: StockRequestItem) => i.id === item.id);
                if (!reqItem) continue;

                await StockRequestRepository.updateItem(reqItem.id, { issuedQty }, tx);

                const pickedBatches = await StockService.pickStoreBatchesFIFO(tx, stockReq.toStoreId!, reqItem.itemId, issuedQty);

                for (const picked of pickedBatches) {
                    if (picked.batchId) {
                        // Decrement from Main Store batch stock
                        await InventoryRepository.updateBatchStock(stockReq.toStoreId!, picked.batchId, -picked.quantity, tx);

                        // Increment in Transit Store batch stock
                        await prismaTx.inventoryBatchStock.upsert({
                            where: { storeId_batchId: { storeId: transitStoreId, batchId: picked.batchId } },
                            update: { quantity: { increment: picked.quantity } },
                            create: {
                                storeId: transitStoreId,
                                batchId: picked.batchId,
                                itemId: reqItem.itemId,
                                quantity: picked.quantity
                            }
                        });
                    }
                }

                // Decrement from Main Store, Increment into Transit Store
                await InventoryRepository.upsertStock(stockReq.toStoreId!, reqItem.itemId, -issuedQty, tx);
                await InventoryRepository.upsertStock(transitStoreId, reqItem.itemId, issuedQty, tx);

                // Main Store TRANSFER_OUT Transaction
                await InventoryRepository.createTransaction({
                    type: 'TRANSFER_OUT',
                    storeId: stockReq.toStoreId!,
                    referenceId: stockReq.requestNr,
                    userId: userId || 'SYSTEM',
                    notes: `Released to Transit - Request ${stockReq.requestNr}`,
                    items: {
                        create: pickedBatches.map((p) => ({
                            itemId: reqItem.itemId,
                            batchId: p.batchId,
                            quantity: -p.quantity
                        }))
                    }
                }, tx);

                // Transit Store TRANSFER_IN Transaction
                await InventoryRepository.createTransaction({
                    type: 'TRANSFER_IN',
                    storeId: transitStoreId,
                    referenceId: stockReq.requestNr,
                    userId: userId || 'SYSTEM',
                    notes: `Transit incoming from Main Store - Request ${stockReq.requestNr}`,
                    items: {
                        create: pickedBatches.map((p) => ({
                            itemId: reqItem.itemId,
                            batchId: p.batchId,
                            quantity: p.quantity
                        }))
                    }
                }, tx);
            }

            const updated = await StockRequestRepository.update(requestId, {
                workflowStage: 'SUB_STORE_RECEIVE',
                releasedById: userId,
                releasedDate: new Date(),
                releasedRemarks: remarks
            }, tx);

            this.safeNotifyFinalAction(updated, 'RELEASED');
            return updated;
        });
    }

    private static async handleSubStoreReceive(data: StockRequestActionData) {
        const { requestId, userId, remarks, items } = data;
        return await prisma.$transaction(async (tx: TransactionClient) => {
            const stockReq = await StockRequestRepository.findById(requestId, { items: true }, tx) as Prisma.StockRequestGetPayload<{
                include: { items: true }
            }> | null;

            if (!stockReq) throw new Error("REQUEST_NOT_FOUND");
            if (stockReq.workflowStage !== 'SUB_STORE_RECEIVE') throw new Error("INVALID_WORKFLOW_STAGE");

            const transitStoreId = await this.getOrCreateTransitStore(tx);
            const prismaTx = tx as unknown as typeof prisma;

            let totalIssued = 0;
            let totalReceived = 0;

            for (const item of items || []) {
                const receivedQty = StockService.round(item.receivedQty || 0);
                const reqItem = stockReq.items.find((i: StockRequestItem) => i.id === item.id);

                if (!reqItem) continue;
                if (receivedQty <= 0) continue;

                totalIssued += StockService.round(reqItem.issuedQty || 0);
                totalReceived += receivedQty;

                await StockRequestRepository.updateItem(reqItem.id, { receivedQty }, tx);

                // Query movements from the Transit Store instead of Main Store
                const movements = await StockRequestRepository.findTransactionItems(stockReq.requestNr, transitStoreId, reqItem.itemId, tx);

                const transactionItems: { itemId: string; batchId: string; quantity: number }[] = [];
                let remainingToReceive = receivedQty;

                for (const m of movements) {
                    if (remainingToReceive <= 0) break;
                    const issuedForThisBatch = Math.abs(Number(m.quantity));
                    const take = Math.min(issuedForThisBatch, remainingToReceive);
                    const batchId = m.batchId;

                    if (!batchId) continue;

                    // Decrement from Transit Store batch stock
                    await prismaTx.inventoryBatchStock.update({
                        where: { storeId_batchId: { storeId: transitStoreId, batchId } },
                        data: { quantity: { decrement: take } }
                    });

                    // Increment in Destination store batch stock
                    await prismaTx.inventoryBatchStock.upsert({
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

                // Decrement from Transit Store, Increment into Destination Store
                await InventoryRepository.upsertStock(transitStoreId, reqItem.itemId, -receivedQty, tx);
                await InventoryRepository.upsertStock(stockReq.fromStoreId!, reqItem.itemId, receivedQty, tx);

                // Transit Store TRANSFER_OUT Transaction
                await InventoryRepository.createTransaction({
                    type: 'TRANSFER_OUT',
                    storeId: transitStoreId,
                    referenceId: stockReq.requestNr,
                    userId: userId || 'SYSTEM',
                    notes: `Transit outgoing to Sub Store - Request ${stockReq.requestNr}`,
                    items: {
                        create: transactionItems.map((ti) => ({
                            itemId: ti.itemId,
                            batchId: ti.batchId,
                            quantity: -ti.quantity
                        }))
                    }
                }, tx);

                // Destination Store TRANSFER_IN Transaction
                await InventoryRepository.createTransaction({
                    type: 'TRANSFER_IN',
                    storeId: stockReq.fromStoreId!,
                    referenceId: stockReq.requestNr,
                    userId: userId || 'SYSTEM',
                    notes: `Received from Transit - Request ${stockReq.requestNr}`,
                    items: {
                        create: transactionItems
                    }
                }, tx);
            }

            const updated = await StockRequestRepository.update(requestId, {
                status: totalReceived >= totalIssued ? 'COMPLETED' : 'PARTIALLY_COMPLETED',
                workflowStage: 'COMPLETED',
                receivedById: userId,
                receivedDate: new Date(),
                receivedRemarks: remarks
            }, tx);

            emitSystemEvent('INVENTORY_UPDATE');
            return updated;
        });
    }

    // --- HELPER NOTIFICATION METHODS ---

    private static async safeNotifyStageChange(req: StockRequest, stage: string, roles: string[]) {
        try {
            await eventBus.publish('inventory.stock_request_stage_changed', {
                request: { id: req.id, requestNr: req.requestNr },
                stage,
                roles
            });
        } catch (nErr) {
            console.error(`Failed to publish stage change event [${stage}]:`, nErr);
        }
    }

    private static async safeNotifyFinalAction(req: StockRequest, action: string, remarks?: string) {
        try {
            await eventBus.publish('inventory.stock_request_finalized', {
                request: { id: req.id, requestNr: req.requestNr, requestedById: req.requestedById },
                action,
                remarks
            });
        } catch (nErr) {
            console.error(`Failed to publish final action event [${action}]:`, nErr);
        }
    }
}
