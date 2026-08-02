import { AppError } from '@/lib/error';
import { safe } from '@/utils/safe-await.util';
import { StockRequest, Prisma, StockRequestItem } from '@prisma/client';
import { StockRequestRepository } from '@/repositories/stock-request.repository';
import { InventoryRepository } from '@/repositories/inventory.repository';
import { emitSystemEvent } from '@/lib/events';
import { eventBus } from '@/lib/events/event-bus';
import { StockService } from './stock.service';
import { StockRequestActionData, TransactionClient } from './types';
import { prisma } from '@/lib/prisma';
import { ProcessGateEngine } from '../approval/process-gate-engine';
import { AuditLedgerService } from './audit-ledger.service';
export class StockRequestService {
    private static generateRequestId(sourceType?: string): string {
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const random = Math.floor(1000 + Math.random() * 9000);

        // Material Purchase Requisitions use PRN- prefix, Internal transfers use REQ- prefix
        const isPurchase = sourceType === 'LOCAL_PURCHASE' || sourceType === 'EMERGENCY_LOCAL' || sourceType === 'SLT' || sourceType === 'PROCUREMENT' || sourceType === 'LOCAL';
        const prefix = isPurchase ? 'PRN' : 'REQ';
        return `${prefix}-${year}${month}${day}-${random}`;
    }

    static async createStockRequest(data: {
        fromStoreId: string;
        requestedById: string;
        items: { itemId: string; requestedQty: string | number; remarks?: string; make?: string; model?: string; suggestedVendor?: string; isCustom?: boolean; customName?: string }[];
        toStoreId?: string;
        priority?: string;
        requiredDate?: string;
        purpose?: string;
        sourceType?: string;
        projectTypes?: string[];
        maintenanceMonths?: string;
        irNumber?: string;
        sltReferenceId?: string; // Used for saving memo/attachment URL
    }): Promise<StockRequest> {
        const { fromStoreId, toStoreId, requestedById, items, priority, requiredDate, purpose, sourceType, projectTypes, maintenanceMonths, irNumber, sltReferenceId } = data;

        const fromStore = await InventoryRepository.findStoreById(fromStoreId);
        if (!fromStore) throw AppError.badRequest("INVALID_STORE");

        let finalToStoreId = toStoreId;

        if (fromStore.type === 'SUB') {
            if (sourceType === 'SLT') {
                throw AppError.badRequest("SUB_STORE_CANNOT_REQUEST_SLT");
            }

            if (sourceType !== 'LOCAL_PURCHASE' && !toStoreId) {
                const mainStore = await InventoryRepository.findMainStore(); 
                if (mainStore) finalToStoreId = mainStore.id;
            }
        }

        const isExternalProcurement = sourceType === 'LOCAL_PURCHASE' || sourceType === 'EMERGENCY_LOCAL' || sourceType === 'SLT' || sourceType === 'PROCUREMENT' || !finalToStoreId;

        // Resolve initial stage dynamically using ProcessGateEngine and RuleEngine
        const initialPolicy = await ProcessGateEngine.findMatchingPolicy({
            entityType: 'MATERIAL_REQUEST',
            fromStatus: 'DRAFT',
            entityPayload: {
                sourceType,
                fromStoreType: fromStore.type,
                toStoreId: finalToStoreId,
                isExternalProcurement
            }
        });

        const defaultInitialStage = isExternalProcurement ? 'OSP_MANAGER_APPROVAL' : 'ARM_APPROVAL';
        const initialWorkflowStage = (initialPolicy && initialPolicy.toStatus && initialPolicy.toStatus !== 'PENDING') ? initialPolicy.toStatus : defaultInitialStage;

        // Process items: create ad-hoc InventoryItems for custom/unregistered items
        const processedItems = [];
        for (const i of items) {
            let finalItemId = i.itemId;
            if (i.isCustom || i.itemId === 'custom') {
                const customName = i.customName || (typeof i.remarks === 'string' ? i.remarks : 'Unregistered Item');
                const randomId = Math.floor(1000 + Math.random() * 9000);
                const code = `UNREG-${Date.now()}-${randomId}`;
                const customItem = await prisma.inventoryItem.create({
                    data: {
                        code,
                        name: customName,
                        description: `Ad-hoc Unregistered Item requested via Requisition ${code}`,
                        unit: 'Nos',
                        type: 'CUSTOM',
                        category: 'OTHERS'
                    }
                });
                finalItemId = customItem.id;
            }

            processedItems.push({
                itemId: finalItemId,
                requestedQty: parseFloat(i.requestedQty.toString()),
                remarks: i.remarks || null,
                make: i.make || null,
                model: i.model || null,
                suggestedVendor: i.suggestedVendor || null
            });
        }

        const req = await StockRequestRepository.create({
            requestNr: StockRequestService.generateRequestId(sourceType),
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
            sltReferenceId: sltReferenceId || null, // Attachment URL stored here
            items: {
                create: processedItems
            }
        });

        const [nErr] = await safe(eventBus.publish('inventory.stock_request_created', {
            request: {
                id: req.id,
                requestNr: req.requestNr,
                fromStoreName: fromStore.name,
                opmcId: fromStore.opmcs?.[0]?.id,
                type: req.sourceType
            },
            stage: initialWorkflowStage
        }));
        
        if (nErr) {
            console.error("Failed to publish stock request created event:", nErr);
        }

        // Emit global system event so connected UI dashboards auto-refresh live
        await safe(emitSystemEvent('INVENTORY_UPDATE', {
            requestId: req.id,
            requestNr: req.requestNr,
            stage: initialWorkflowStage
        }));

        // --- DYNAMIC PROCESS GATE ENGINE INTEGRATION ---
        try {
            const { ProcessGateEngine } = await import('@/services/approval/process-gate-engine');
            const gateResult = await ProcessGateEngine.startGate({
                entityType: 'MATERIAL_REQUEST',
                entityId: req.id,
                currentStatus: initialWorkflowStage
            });

            if (gateResult.status === 'GATE_PASSED') {
                // If there's no gate policy, we can automatically mark it as approved
                // For safety, let's leave it pending for manual intervention or we can call domain action
                console.log(`[ProcessGateEngine] Gate automatically passed for MRN ${req.requestNr}. No active policy found.`);
            } else {
                console.log(`[ProcessGateEngine] Gate started for MRN ${req.requestNr}, instance: ${gateResult.instanceId}`);
            }
        } catch (gateErr) {
            console.error("[ProcessGateEngine] Failed to initiate gate for MRN:", gateErr);
        }

        return req;
    }

    static async getStockRequests(filters: {
        storeId?: string;
        isApprover?: boolean;
        status?: string;
        workflowStage?: string;
        sourceType?: string;
        procurementStatus?: string;
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
            const stages = filters.workflowStage.split(',');
            where.workflowStage = { in: stages };
        }

        if (filters.sourceType) {
            where.sourceType = filters.sourceType;
        }

        if (filters.procurementStatus) {
            const pStatuses = filters.procurementStatus.split(',');
            where.procurementStatus = { in: pStatuses };
        }

        return await StockRequestRepository.findMany({
            where,
            include: {
                fromStore: true,
                toStore: true,
                requestedBy: true,
                items: { include: { item: true } },
                purchaseOrders: {
                    include: {
                        items: true
                    }
                },
                grns: {
                    include: {
                        receivedBy: true,
                        items: { include: { item: true } }
                    },
                    orderBy: { createdAt: 'desc' }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
    }

    /**
     * Main action dispatcher for Stock Requests
     */
    static async processStockRequestAction(data: StockRequestActionData) {
        const { action, requestId, userId } = data;

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { role: true }
        });

        if (!user) {
            throw AppError.unauthorized("USER_NOT_FOUND");
        }

        // Segregation of Duties (SoD) enforcement: Request creator cannot approve/release/process their own request
        if (['ARM_APPROVE', 'STORES_MANAGER_APPROVE', 'APPROVE', 'RELEASE'].includes(action)) {
            const stockReq = await prisma.stockRequest.findUnique({
                where: { id: requestId },
                select: { requestedById: true }
            });
            if (user.role !== 'SUPER_ADMIN' && stockReq && stockReq.requestedById === userId) {
                throw AppError.badRequest("SEGREGATION_OF_DUTIES_VIOLATION: Request creator cannot approve or release this stock request.");
            }
        }

        // Stage-Specific Role Isolation Enforcement
        if (action === 'RELEASE') {
            if (!['STORES_MANAGER', 'STORES_ASSISTANT', 'ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
                throw AppError.forbidden("ROLE_PERMISSION_DENIED: Only Main Stores Officers can perform MIN Release and dispatch warehouse stock.");
            }
        } else if (action === 'ARM_APPROVE') {
            if (!['AREA_MANAGER', 'OSP_MANAGER', 'ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
                throw AppError.forbidden("ROLE_PERMISSION_DENIED: Only Area Managers and OSP Managers can perform ARM Stage Approvals.");
            }
        }

        switch (action) {
            case 'ARM_APPROVE':
            case 'STORES_MANAGER_APPROVE':
            case 'APPROVE':
            case 'GATE_PASSED':
                return StockRequestService.handleGatePassed(data);
            case 'RETURN':
                return StockRequestService.handleReturn(data);
            case 'RECALL_APPROVAL':
                return StockRequestService.handleRecallApproval(data);
            case 'REJECT':
                return StockRequestService.handleReject(data);
            case 'CREATE_PO':
                return StockRequestService.handleCreatePO(data);
            case 'UPDATE_PROCUREMENT_STATUS':
                return StockRequestService.handleUpdateProcurementStatus(data);
            case 'PROCUREMENT_COMPLETE':
                return StockRequestService.handleProcurementComplete(data);
            case 'RELEASE':
                return StockRequestService.handleMainStoreRelease(data);
            case 'RECEIVE':
                return StockRequestService.handleSubStoreReceive(data);
            default:
                throw AppError.badRequest('INVALID_ACTION');
        }
    }

    private static async handleCreatePO(data: StockRequestActionData) {
        const { requestId, poNumber, vendor, expectedDelivery, remarks, items } = data;

        if (!poNumber || !vendor) {
            throw AppError.badRequest('PO Number and Vendor are required');
        }

        const updated = await prisma.$transaction(async (tx) => {
            const newPO = await tx.purchaseOrder.create({
                data: {
                    poNumber,
                    vendor,
                    expectedDelivery: expectedDelivery ? new Date(expectedDelivery) : undefined,
                    stockRequestId: requestId,
                    status: 'APPROVED'
                }
            });

            if (items && items.length > 0) {
                const poItems = items.map(item => ({
                    purchaseOrderId: newPO.id,
                    stockRequestItemId: item.id,
                    quantity: item.orderQty || 1,
                    unitPrice: item.unitPrice || 0,
                    taxAmount: item.taxAmount || 0,
                    totalAmount: item.totalAmount || 0,
                }));
                
                await tx.purchaseOrderItem.createMany({
                    data: poItems
                });
            }

            const request = await tx.stockRequest.update({
                where: { id: requestId },
                data: {
                    procurementStatus: 'PO_CREATED',
                    remarks: remarks || undefined
                },
                include: {
                    items: { include: { item: true } },
                    fromStore: true,
                    toStore: true,
                    requestedBy: true,
                    purchaseOrders: { include: { items: true } }
                }
            });
            
            return request;
        });

        this.safeNotifyFinalAction(updated as unknown as StockRequest, 'CREATE_PO', remarks);
        return updated;
    }

    private static async handleUpdateProcurementStatus(data: StockRequestActionData) {
        const { requestId, procurementStatus, remarks } = data;
        const updatePayload: Record<string, unknown> = {
            procurementStatus: procurementStatus || undefined,
            remarks: remarks || undefined
        };

        if (procurementStatus === 'COMPLETED') {
            updatePayload.workflowStage = 'GRN_PENDING';
            updatePayload.status = 'APPROVED';
        }

        const updated = await StockRequestRepository.update(requestId, updatePayload);
        this.safeNotifyFinalAction(updated, `PROCUREMENT_STATUS_${procurementStatus}`);
        return updated;
    }

    private static async handleGatePassed(data: StockRequestActionData) {
        const { requestId, userId, remarks, items } = data;
        
        return await prisma.$transaction(async (tx: TransactionClient) => {
            const stockReq = await StockRequestRepository.findById(requestId, { items: true, fromStore: true, toStore: true }, tx);
            if (!stockReq) throw AppError.badRequest("REQUEST_NOT_FOUND");

            // Resolve effective stage for PENDING/legacy records dynamically
            const isExternal = stockReq.sourceType === 'LOCAL_PURCHASE' || stockReq.sourceType === 'EMERGENCY_LOCAL' || stockReq.sourceType === 'SLT' || stockReq.sourceType === 'PROCUREMENT' || !stockReq.toStoreId;
            const effectiveStage = (stockReq.workflowStage === 'PENDING' || stockReq.workflowStage === 'REQUEST')
                ? (isExternal ? 'OSP_MANAGER_APPROVAL' : 'ARM_APPROVAL')
                : stockReq.workflowStage;

            // Query active DB Process Gate Policy for current workflow stage
            const policy = await (tx as unknown as typeof prisma).processGatePolicy.findFirst({
                where: { entityType: 'MATERIAL_REQUEST', fromStatus: effectiveStage, isEnabled: true },
                include: { approvalLevels: true }
            });

            if (!policy) {
                throw AppError.badRequest(`NO_PROCESS_GATE_POLICY: No active Process Gate Policy configured for stage '${stockReq.workflowStage}'. Please configure policy under Admin > Process Gates.`);
            }

            const nextStage = policy.toStatus;

            // Condition-Based Domain Routing (Zero-Hardcoding via Event Bus Pattern)
            const rolesToNotify: string[] = Array.isArray(policy.rolesToNotify) ? (policy.rolesToNotify as string[]) : [];
            const domainAction = policy.domainAction;

            if (domainAction) {
                const { DomainActionDispatcher } = await import('@/services/approval/domain-dispatcher.service');
                await DomainActionDispatcher.dispatch({
                    action: domainAction,
                    entityId: stockReq.id,
                    entityType: 'MATERIAL_REQUEST',
                    userId: data.userId,
                    instanceId: data.instanceId,
                    stockReq,
                    items
                }, tx);
            }

            // Dynamic update payload driven by database gate policy attributes
            const updatePayload: Record<string, unknown> = {
                workflowStage: nextStage
            };

            // Record stage-specific approval audit log
            const primaryRole = policy.approvalLevels?.[0]?.requiredRole;
            if (primaryRole === 'OSP_MANAGER' || stockReq.workflowStage.includes('OSP')) {
                updatePayload.hsOspAction = 'APPROVED';
                updatePayload.hsOspDate = new Date();
                updatePayload.managerAction = 'APPROVED';
                updatePayload.managerDate = new Date();
                updatePayload.approvedById = userId;
            } else if (primaryRole === 'AREA_MANAGER' || stockReq.workflowStage.includes('ARM')) {
                updatePayload.armAction = 'APPROVED';
                updatePayload.armDate = new Date();
                updatePayload.armRemarks = remarks || 'Approved by Area Manager';
                updatePayload.armApprovedById = userId;
            } else if (primaryRole === 'STORES_MANAGER' || stockReq.workflowStage.includes('STORES')) {
                updatePayload.storesManagerAction = 'APPROVED';
                updatePayload.storesManagerDate = new Date();
                updatePayload.storesManagerRemarks = remarks || 'Approved by Stores Manager';
                updatePayload.storesManagerApprovedById = userId;
            }

            if (nextStage === 'MAIN_STORE_RELEASE' || nextStage === 'COMPLETED' || nextStage === 'PROCUREMENT' || nextStage === 'GRN_PENDING') {
                updatePayload.status = 'APPROVED';
                updatePayload.approvedById = userId;
            }

            // Perform dynamic update using StockRequestRepository
            const updated = await StockRequestRepository.update(requestId, updatePayload, tx);

            // Event-Driven Side Effect triggers
            this.safeNotifyStageChange(updated, nextStage, rolesToNotify);
            
            return updated;
        });
    }

    private static async handleReturn(data: StockRequestActionData) {
        const { requestId, remarks } = data;
        const updated = await StockRequestRepository.update(requestId, {
            workflowStage: 'RETURNED',
            status: 'RETURNED',
            remarks: remarks
        });

        this.safeNotifyFinalAction(updated, 'RETURNED', remarks);
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

    private static async handleRecallApproval(data: StockRequestActionData) {
        const { requestId, userId, remarks } = data;
        
        return await prisma.$transaction(async (tx) => {
            // 1. Point of no return Check (Has a PO been created?)
            const poExists = await tx.purchaseOrder.findFirst({
                where: { stockRequestId: requestId }
            });
            if (poExists) {
                throw AppError.badRequest("CANNOT_RECALL_PO_EXISTS: A Purchase Order has already been generated. This request can no longer be recalled.");
            }

            const stockReq = await tx.stockRequest.findUnique({
                where: { id: requestId },
                include: { items: true }
            });

            if (!stockReq) throw AppError.badRequest("REQUEST_NOT_FOUND");
            if (stockReq.status !== 'APPROVED') throw AppError.badRequest("INVALID_STATE: Only approved requests can be recalled.");

            // 2. Clear approved quantities on items
            if (stockReq.items && stockReq.items.length > 0) {
                for (const item of stockReq.items) {
                    await tx.stockRequestItem.update({
                        where: { id: item.id },
                        data: { approvedQty: 0 } // Reset to unapproved
                    });
                }
            }

            // 3. Revert Request status to Management Review Stage
            const isExternal = stockReq.sourceType === 'LOCAL_PURCHASE' || stockReq.sourceType === 'EMERGENCY_LOCAL' || stockReq.sourceType === 'SLT' || stockReq.sourceType === 'PROCUREMENT' || !stockReq.toStoreId;
            const targetRecallStage = isExternal ? 'OSP_MANAGER_APPROVAL' : 'ARM_APPROVAL';

            const updated = await tx.stockRequest.update({
                where: { id: requestId },
                data: {
                    workflowStage: targetRecallStage,
                    status: 'PENDING',
                    approvedById: null,
                    hsOspAction: null,
                    managerAction: null,
                    armAction: null,
                    storesManagerAction: null,
                    remarks: remarks || 'Approval recalled for re-evaluation.'
                },
                include: {
                    requestedBy: true
                }
            });

            // 4. Record explicit Audit Log
            await tx.auditLog.create({
                data: {
                    action: 'RECALL_APPROVAL',
                    entityId: requestId,
                    entity: 'STOCK_REQUEST',
                    userId: userId,
                    newValue: { details: 'Manager recalled PRN approval to adjust quantities/values.' },
                    ipAddress: 'SYSTEM',
                    userAgent: 'SYSTEM'
                }
            });

            // 5. Notify Requester
            if (stockReq.requestedById) {
                await tx.notification.create({
                    data: {
                        userId: stockReq.requestedById,
                        title: 'Approval Recalled',
                        message: `PRN ${stockReq.requestNr} approval was recalled for re-evaluation.`,
                        type: 'WARNING',
                        metadata: { requestId }
                    }
                });
            }

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

            if (!stockReq) throw AppError.badRequest("REQUEST_NOT_FOUND");
            if (stockReq.workflowStage !== 'MAIN_STORE_RELEASE') throw AppError.badRequest("INVALID_WORKFLOW_STAGE");

            const issueNoteNumber = (stockReq as Record<string, unknown>).issueNoteNumber as string | null || await AuditLedgerService.generateMINNumber(tx);
            const transitStoreId = await this.getOrCreateTransitStore(tx);
            const prismaTx = tx as unknown as typeof prisma;

            const itemIds = stockReq.items.map((i: StockRequestItem) => i.itemId);

            // 1. Bulk pre-fetch available batches and global stocks
            const availableBatches = await InventoryRepository.findAvailableBatchesBulk(stockReq.toStoreId!, itemIds, tx);

            const transitBatchStocks = await prismaTx.inventoryBatchStock.findMany({
                where: { storeId: transitStoreId, itemId: { in: itemIds } }
            });
            const transitBatchStockMap = new Map<string, Record<string, unknown>>(transitBatchStocks.map(bs => [bs.batchId, bs as unknown as Record<string, unknown>]));

            const globalStocks = await prismaTx.inventoryStock.findMany({
                where: {
                    storeId: { in: [stockReq.toStoreId!, transitStoreId] },
                    itemId: { in: itemIds }
                }
            });
            const globalStockSet = new Set(globalStocks.map(gs => `${gs.storeId}:${gs.itemId}`));

            const mainStoreTransactionItems: Array<{ itemId: string; batchId: string; quantity: number }> = [];
            const transitStoreTransactionItems: Array<{ itemId: string; batchId: string; quantity: number }> = [];

            let hasRemainingBalance = false;

            for (const reqItem of stockReq.items) {
                const itemPayload = items?.find(i => i.id === reqItem.id);
                const newlyIssuedQty = itemPayload ? StockService.round(itemPayload.issuedQty || 0) : 0;
                
                const targetQty = reqItem.approvedQty > 0 ? reqItem.approvedQty : reqItem.requestedQty;
                const currentIssuedQty = reqItem.issuedQty || 0;
                const totalIssuedQty = currentIssuedQty + newlyIssuedQty;
                
                if (totalIssuedQty < targetQty) {
                    hasRemainingBalance = true;
                }
                
                if (newlyIssuedQty <= 0) continue;

                if (totalIssuedQty > targetQty) {
                    throw AppError.badRequest(`Over-issuance detected: Cannot issue more than approved quantity for item ${reqItem.itemId}.`);
                }

                // Update cumulative issued quantity
                await StockRequestRepository.updateItem(reqItem.id, { issuedQty: totalIssuedQty }, tx);

                const pickedBatches = StockService.pickStoreBatchesFIFOBulk(availableBatches, reqItem.itemId, newlyIssuedQty);

                for (const picked of pickedBatches) {
                    if (picked.batchId) {
                        // Decrement from Main Store batch stock
                        await InventoryRepository.updateBatchStock(stockReq.toStoreId!, picked.batchId, -picked.quantity, tx);

                        // Increment in Transit Store batch stock
                        const existingTransitBS = transitBatchStockMap.get(picked.batchId);
                        if (existingTransitBS) {
                            await prismaTx.inventoryBatchStock.update({
                                where: { storeId_batchId: { storeId: transitStoreId, batchId: picked.batchId } },
                                data: { quantity: { increment: picked.quantity } }
                            });
                        } else {
                            await prismaTx.inventoryBatchStock.create({
                                data: {
                                    storeId: transitStoreId,
                                    batchId: picked.batchId,
                                    itemId: reqItem.itemId,
                                    quantity: picked.quantity
                                }
                            });
                            transitBatchStockMap.set(picked.batchId, { storeId: transitStoreId, batchId: picked.batchId, itemId: reqItem.itemId, quantity: picked.quantity });
                        }
                    }
                }

                // Decrement from Main Store, Increment into Transit Store
                const mainStoreKey = `${stockReq.toStoreId}:${reqItem.itemId}`;
                const mainStockBefore = await InventoryRepository.findStock(stockReq.toStoreId!, reqItem.itemId, tx);
                const transitStockBefore = await InventoryRepository.findStock(transitStoreId, reqItem.itemId, tx);
                const mainQtyBefore = mainStockBefore ? Number(mainStockBefore.quantity) : 0;
                const transitQtyBefore = transitStockBefore ? Number(transitStockBefore.quantity) : 0;

                if (globalStockSet.has(mainStoreKey)) {
                    await InventoryRepository.commitAllocatedStock(stockReq.toStoreId!, reqItem.itemId, newlyIssuedQty, tx);
                } else {
                    throw AppError.badRequest("Cannot commit allocated stock for non-existent stock record.");
                }

                const transitStoreKey = `${transitStoreId}:${reqItem.itemId}`;
                if (globalStockSet.has(transitStoreKey)) {
                    await prismaTx.inventoryStock.update({
                        where: { storeId_itemId: { storeId: transitStoreId, itemId: reqItem.itemId } },
                        data: { quantity: { increment: newlyIssuedQty } }
                    });
                } else {
                    await prismaTx.inventoryStock.create({
                        data: { storeId: transitStoreId, itemId: reqItem.itemId, quantity: newlyIssuedQty }
                    });
                    globalStockSet.add(transitStoreKey);
                }

                // Write Immutable Checksum Ledger Entries
                await AuditLedgerService.recordEntry({
                    storeId: stockReq.toStoreId!,
                    itemId: reqItem.itemId,
                    transactionType: 'STORE_TRANSFER_OUT',
                    referenceType: 'StockRequest',
                    referenceId: stockReq.requestNr,
                    quantityBefore: mainQtyBefore,
                    quantityChange: -newlyIssuedQty,
                    quantityAfter: mainQtyBefore - newlyIssuedQty,
                    performedById: userId || 'SYSTEM',
                }, tx);

                await AuditLedgerService.recordEntry({
                    storeId: transitStoreId,
                    itemId: reqItem.itemId,
                    transactionType: 'STORE_TRANSFER_IN',
                    referenceType: 'StockRequest',
                    referenceId: stockReq.requestNr,
                    quantityBefore: transitQtyBefore,
                    quantityChange: newlyIssuedQty,
                    quantityAfter: transitQtyBefore + newlyIssuedQty,
                    performedById: userId || 'SYSTEM',
                }, tx);

                for (const p of pickedBatches) {
                    if (p.batchId) {
                        mainStoreTransactionItems.push({
                            itemId: reqItem.itemId,
                            batchId: p.batchId,
                            quantity: -p.quantity
                        });
                        transitStoreTransactionItems.push({
                            itemId: reqItem.itemId,
                            batchId: p.batchId,
                            quantity: p.quantity
                        });
                    }
                }
            }

            // Write Consolidated Transactions
            if (mainStoreTransactionItems.length > 0) {
                await InventoryRepository.createTransaction({
                    type: 'TRANSFER_OUT',
                    storeId: stockReq.toStoreId!,
                    referenceId: stockReq.requestNr,
                    userId: userId || 'SYSTEM',
                    notes: `Released to Transit (Partial/Full) - Request ${stockReq.requestNr}`,
                    items: {
                        create: mainStoreTransactionItems
                    }
                }, tx);
            }

            if (transitStoreTransactionItems.length > 0) {
                await InventoryRepository.createTransaction({
                    type: 'TRANSFER_IN',
                    storeId: transitStoreId,
                    referenceId: stockReq.requestNr,
                    userId: userId || 'SYSTEM',
                    notes: `Transit incoming from Main Store (Partial/Full) - Request ${stockReq.requestNr}`,
                    items: {
                        create: transitStoreTransactionItems
                    }
                }, tx);
            }

            const nextStage = hasRemainingBalance ? 'PARTIALLY_ISSUED' : 'SUB_STORE_RECEIVE';
            const nextStatus = hasRemainingBalance ? 'PARTIALLY_ISSUED' : 'APPROVED';

            const updated = await StockRequestRepository.update(requestId, {
                workflowStage: nextStage,
                status: nextStatus,
                issueNoteNumber,
                releasedById: userId,
                releasedDate: new Date(),
                releasedRemarks: remarks
            } as Prisma.StockRequestUncheckedUpdateInput, tx);

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

            if (!stockReq) throw AppError.badRequest("REQUEST_NOT_FOUND");
            if (stockReq.workflowStage !== 'SUB_STORE_RECEIVE' && stockReq.workflowStage !== 'PARTIALLY_ISSUED') {
                throw AppError.badRequest("INVALID_WORKFLOW_STAGE");
            }

            const transitStoreId = await this.getOrCreateTransitStore(tx);
            const prismaTx = tx as unknown as typeof prisma;

            const itemIds = stockReq.items.map((i: StockRequestItem) => i.itemId);

            // 1. Bulk pre-fetch transit store movements for the requestNr
            const allMovements = await prismaTx.inventoryTransactionItem.findMany({
                where: {
                    transaction: {
                        referenceId: stockReq.requestNr,
                        storeId: transitStoreId
                    },
                    itemId: { in: itemIds }
                }
            });

            // Group movements by itemId
            const movementsMap = new Map<string, typeof allMovements>();
            for (const m of allMovements) {
                const list = movementsMap.get(m.itemId) || [];
                list.push(m);
                movementsMap.set(m.itemId, list);
            }

            // 2. Pre-fetch available batch stock records
            const batchStocks = await prismaTx.inventoryBatchStock.findMany({
                where: {
                    storeId: { in: [transitStoreId, stockReq.fromStoreId!] },
                    itemId: { in: itemIds }
                }
            });
            const batchStockMap = new Map<string, Record<string, unknown>>(batchStocks.map(bs => [`${bs.storeId}:${bs.batchId}`, bs as unknown as Record<string, unknown>]));

            const globalStocks = await prismaTx.inventoryStock.findMany({
                where: {
                    storeId: { in: [transitStoreId, stockReq.fromStoreId!] },
                    itemId: { in: itemIds }
                }
            });
            const globalStockSet = new Set(globalStocks.map(gs => `${gs.storeId}:${gs.itemId}`));

            const transitStoreTransactionItems: Array<{ itemId: string; batchId: string; quantity: number }> = [];
            const subStoreTransactionItems: Array<{ itemId: string; batchId: string; quantity: number }> = [];

            // We mutate reqItem.receivedQty in memory so we can sum it up later
            for (const item of items || []) {
                const incomingReceiveQty = StockService.round(item.receivedQty || 0);
                const reqItem = stockReq.items.find((i: StockRequestItem) => i.id === item.id);

                if (!reqItem) continue;
                if (incomingReceiveQty <= 0) continue;
                
                const newTotalReceived = StockService.round((reqItem.receivedQty || 0) + incomingReceiveQty);
                reqItem.receivedQty = newTotalReceived; // Update in memory

                await StockRequestRepository.updateItem(reqItem.id, { receivedQty: newTotalReceived }, tx);

                const movements = movementsMap.get(reqItem.itemId) || [];
                const transactionItems: { itemId: string; batchId: string; quantity: number }[] = [];
                let remainingToReceive = incomingReceiveQty;

                for (const m of movements) {
                    if (remainingToReceive <= 0) break;
                    const issuedForThisBatch = Math.abs(Number(m.quantity));
                    const take = Math.min(issuedForThisBatch, remainingToReceive);
                    const batchId = m.batchId;

                    if (!batchId) continue;

                    // Decrement from Transit Store batch stock
                    const transitBSKey = `${transitStoreId}:${batchId}`;
                    const transitBS = batchStockMap.get(transitBSKey);
                    if (transitBS) {
                        await InventoryRepository.decrementBatchStockAtomic(transitStoreId, batchId, take, prismaTx);
                    }

                    // Increment in Destination store batch stock
                    const destBSKey = `${stockReq.fromStoreId}:${batchId}`;
                    const destBS = batchStockMap.get(destBSKey);
                    if (destBS) {
                        await prismaTx.inventoryBatchStock.update({
                            where: { storeId_batchId: { storeId: stockReq.fromStoreId!, batchId } },
                            data: { quantity: { increment: take } }
                        });
                    } else {
                        await prismaTx.inventoryBatchStock.create({
                            data: {
                                storeId: stockReq.fromStoreId!,
                                batchId,
                                itemId: reqItem.itemId,
                                quantity: take
                            }
                        });
                        batchStockMap.set(destBSKey, { storeId: stockReq.fromStoreId!, batchId, itemId: reqItem.itemId, quantity: take });
                    }

                    transactionItems.push({ itemId: reqItem.itemId, batchId, quantity: take });
                    remainingToReceive = StockService.round(remainingToReceive - take);
                }

                // Pre-fetch stock quantities for Ledger BEFORE modifying
                const transitStockBefore = await InventoryRepository.findStock(transitStoreId, reqItem.itemId, tx);
                const destStockBefore = await InventoryRepository.findStock(stockReq.fromStoreId!, reqItem.itemId, tx);
                
                const transitQtyBefore = transitStockBefore ? Number(transitStockBefore.quantity) : 0;
                const destQtyBefore = destStockBefore ? Number(destStockBefore.quantity) : 0;

                // Decrement from Transit Store, Increment into Destination Store
                await InventoryRepository.decrementStockAtomic(transitStoreId, reqItem.itemId, incomingReceiveQty, prismaTx);

                const destStockKey = `${stockReq.fromStoreId}:${reqItem.itemId}`;
                if (globalStockSet.has(destStockKey)) {
                    await prismaTx.inventoryStock.update({
                        where: { storeId_itemId: { storeId: stockReq.fromStoreId!, itemId: reqItem.itemId } },
                        data: { quantity: { increment: incomingReceiveQty } }
                    });
                } else {
                    await prismaTx.inventoryStock.create({
                        data: { storeId: stockReq.fromStoreId!, itemId: reqItem.itemId, quantity: incomingReceiveQty }
                    });
                    globalStockSet.add(destStockKey);
                }

                // Write Immutable Checksum Ledger Entries
                await AuditLedgerService.recordEntry({
                    storeId: transitStoreId,
                    itemId: reqItem.itemId,
                    transactionType: 'STORE_TRANSFER_OUT',
                    referenceType: 'StockRequest',
                    referenceId: stockReq.requestNr,
                    quantityBefore: transitQtyBefore,
                    quantityChange: -incomingReceiveQty,
                    quantityAfter: transitQtyBefore - incomingReceiveQty,
                    performedById: userId || 'SYSTEM',
                }, tx);

                await AuditLedgerService.recordEntry({
                    storeId: stockReq.fromStoreId!,
                    itemId: reqItem.itemId,
                    transactionType: 'STORE_TRANSFER_IN',
                    referenceType: 'StockRequest',
                    referenceId: stockReq.requestNr,
                    quantityBefore: destQtyBefore,
                    quantityChange: incomingReceiveQty,
                    quantityAfter: destQtyBefore + incomingReceiveQty,
                    performedById: userId || 'SYSTEM',
                }, tx);

                for (const ti of transactionItems) {
                    transitStoreTransactionItems.push({
                        itemId: ti.itemId,
                        batchId: ti.batchId,
                        quantity: -ti.quantity
                    });
                    subStoreTransactionItems.push({
                        itemId: ti.itemId,
                        batchId: ti.batchId,
                        quantity: ti.quantity
                    });
                }
            }

            // Write Consolidated Transactions
            if (transitStoreTransactionItems.length > 0) {
                await InventoryRepository.createTransaction({
                    type: 'TRANSFER_OUT',
                    storeId: transitStoreId,
                    referenceId: stockReq.requestNr,
                    userId: userId || 'SYSTEM',
                    notes: `Transit outgoing to Sub Store - Request ${stockReq.requestNr}`,
                    items: {
                        create: transitStoreTransactionItems
                    }
                }, tx);
            }

            if (subStoreTransactionItems.length > 0) {
                await InventoryRepository.createTransaction({
                    type: 'TRANSFER_IN',
                    storeId: stockReq.fromStoreId!,
                    referenceId: stockReq.requestNr,
                    userId: userId || 'SYSTEM',
                    notes: `Received from Transit - Request ${stockReq.requestNr}`,
                    items: {
                        create: subStoreTransactionItems
                    }
                }, tx);
            }

            let totalIssued = 0;
            let totalReceived = 0;
            let totalApproved = 0;

            for (const item of stockReq.items) {
                totalIssued += StockService.round(item.issuedQty || 0);
                totalReceived += StockService.round(item.receivedQty || 0);
                totalApproved += StockService.round(item.approvedQty > 0 ? item.approvedQty : item.requestedQty);
            }

            const hasUnissuedBalance = totalIssued < totalApproved;
            const hasUnreceivedBalance = totalReceived < totalIssued;
            
            // If they received everything that was issued, but there's STILL unissued balance, it remains PARTIALLY_ISSUED.
            // If they didn't receive everything issued yet, but there's no unissued balance, it goes to SUB_STORE_RECEIVE.
            // Wait, if hasUnissuedBalance, it goes back to/stays PARTIALLY_ISSUED (main store needs to issue more).
            // If !hasUnissuedBalance and !hasUnreceivedBalance, it is COMPLETED.
            let nextStage = stockReq.workflowStage;
            let nextStatus = stockReq.status;

            if (hasUnissuedBalance) {
                nextStage = 'PARTIALLY_ISSUED';
                nextStatus = 'PARTIALLY_ISSUED';
            } else if (hasUnreceivedBalance) {
                nextStage = 'SUB_STORE_RECEIVE';
                nextStatus = 'APPROVED'; // or 'PARTIALLY_COMPLETED'
            } else {
                nextStage = 'COMPLETED';
                nextStatus = 'COMPLETED';
            }

            const updated = await StockRequestRepository.update(requestId, {
                status: nextStatus,
                workflowStage: nextStage,
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
        const [nErr] = await safe(eventBus.publish('inventory.stock_request_stage_changed', {
            request: { id: req.id, requestNr: req.requestNr },
            stage,
            roles
        }));
        if (nErr) {
            console.error(`Failed to publish stage change event [${stage}]:`, nErr);
        }

        // --- DYNAMIC PROCESS GATE ENGINE INTEGRATION ---
        try {
            const { ProcessGateEngine } = await import('@/services/approval/process-gate-engine');
            
            const gateResult = await ProcessGateEngine.startGate({
                entityType: 'MATERIAL_REQUEST',
                entityId: req.id,
                currentStatus: stage,
                entityPayload: req
            });

            if (gateResult.status === 'GATE_PASSED') {
                console.log(`[ProcessGateEngine] Gate automatically passed for stage ${stage}. No active policy found.`);
            } else {
                console.log(`[ProcessGateEngine] Gate started for stage ${stage}, instance: ${gateResult.instanceId}`);
            }
        } catch (gateErr) {
            console.error(`[ProcessGateEngine] Failed to initiate gate for stage ${stage}:`, gateErr);
        }
    }

    private static async safeNotifyFinalAction(req: StockRequest, action: string, remarks?: string) {
        const [nErr] = await safe(eventBus.publish('inventory.stock_request_finalized', {
            request: { id: req.id, requestNr: req.requestNr, requestedById: req.requestedById },
            action,
            remarks
        }));
        if (nErr) {
            console.error(`Failed to publish final action event [${action}]:`, nErr);
        }
    }
}
