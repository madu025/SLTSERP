import { ServiceOrder } from '@prisma/client';
import { TransactionClient } from '../inventory/types';
import { SODInvoicingService } from './sod.invoicing.service';
import { SODMaterialService } from './sod.material.service';
import { SODLifecycleService } from './sod.lifecycle.service';
import { SODSyncService } from './sod.sync.service';
import { LedgerService } from '../finance/ledger.service';
import { SODQueryService } from './sod.query.service';
import { SODImportService } from './sod.import.service';
import { GetServiceOrdersParams, ServiceOrderUpdateData } from './sod-types';
import { ServiceOrderRepository } from '@/repositories/service-order.repository';
import { prisma } from '@/lib/prisma';

/**
 * ServiceOrderService (Facade)
 * ----------------------------
 * This class acts as a facade, delegating specific SOD logic to specialized sub-services.
 */
export class ServiceOrderService {

    /**
     * Get all service orders with filtering and sorting
     */
    static async getServiceOrders(_userId: string, params: GetServiceOrdersParams) {
        return SODQueryService.getServiceOrders(params);
    }

    /**
     * Get a service order by soNum with full details
     */
    static async getServiceOrderBySoNum(soNum: string) {
        return SODQueryService.getServiceOrderBySoNum(soNum);
    }

    /**
     * Bulk Import from Excel
     */
    static async bulkImportServiceOrders(rtom: string, data: Record<string, unknown>[], opmcId: string) {
        return SODImportService.bulkImportServiceOrders(rtom, data, opmcId);
    }

    /**
     * Patch Update (Status Change, Completion, Material Usage, etc.)
     */
    static async patchServiceOrder(id: string, data: ServiceOrderUpdateData, userId?: string): Promise<ServiceOrder> {
        if (!id) throw new Error('ID_REQUIRED');

        const oldOrder = await ServiceOrderRepository.findById(id, { materialUsage: true });
        if (!oldOrder) throw new Error('ORDER_NOT_FOUND');

        // 1. UNIQUE CONSTRAINT PROTECTION
        const collisionId = await SODLifecycleService.validateStatusTransition(id, oldOrder.soNum, data.status, oldOrder.status);
        if (collisionId) {
            console.warn(`[PATCH] Status collision detected for ${oldOrder.soNum}. Redirecting update.`);
            return this.patchServiceOrder(collisionId, { ...data, status: undefined }, userId);
        }

        // 2. Prepare Update Data
        const updateData = await SODLifecycleService.prepareStatusTransition(oldOrder, data);

        // 3. Financial calculations
        const isCompleting = updateData.sltsStatus === 'COMPLETED' || (oldOrder.sltsStatus !== 'COMPLETED' && data.sltsStatus === 'COMPLETED');
        if (isCompleting) {
            const distance = (updateData.dropWireDistance as number) ?? oldOrder.dropWireDistance ?? 0;
            const { revenueAmount, contractorAmount } = await SODInvoicingService.calculateAmounts(oldOrder.opmcId, distance);
            updateData.revenueAmount = revenueAmount;
            updateData.contractorAmount = contractorAmount;
        }

        // 4. System specific manual updates (Snapshots) - Fetch before transaction
        const configs: { value: string }[] = await prisma.$queryRaw`SELECT value FROM "SystemConfig" WHERE key = 'OSP_MATERIAL_SOURCE' LIMIT 1`;
        const currentSource = configs[0]?.value || 'SLT';
        updateData.materialSource = currentSource;

        // 5. TRANSACTIONAL DATABASE UPDATE
        const finalOrder = await prisma.$transaction(async (tx: TransactionClient) => {
            // IF COMMENT IS UPDATED, CREATE A HISTORY RECORD
            if (data.comments) {
                await ServiceOrderRepository.createComment({
                    serviceOrderId: id,
                    comment: data.comments,
                    authorId: userId
                }, tx);
            }

            // GAP 1 FIX: Rollback material usage INSIDE the transaction when status is RETURN.
            // This ensures atomic consistency — if rollback fails, the status update is also rolled back.
            const isTransitioningToReturn = data.sltsStatus === 'RETURN' && oldOrder.sltsStatus !== 'RETURN';
            if (isTransitioningToReturn) {
                await SODMaterialService.rollbackMaterialUsage(tx, id, userId || 'SYSTEM');
                // Reversal entry in General Ledger
                await LedgerService.rollbackSodTransaction(tx, id);
            }

            // Material usage processing (only on COMPLETED, not on RETURN)
            const isCompletedState = (data.status === 'COMPLETED' || updateData.sltsStatus === 'COMPLETED' || oldOrder.sltsStatus === 'COMPLETED');
            const hasMaterialUpdate = (data.materialUsage && Array.isArray(data.materialUsage));

            if (hasMaterialUpdate && !isTransitioningToReturn) {
                const { InventoryService } = await import('../inventory');
                const contractorId = (data.contractorId || (updateData.contractorId as string | null) || oldOrder.contractorId) as string | null;
                
                // Rollback old GL consumption if the order was already completed
                if (oldOrder.sltsStatus === 'COMPLETED') {
                    await LedgerService.rollbackSodTransaction(tx, id, `Reversal for Material Adjustment on SOD: ${id}`);
                }

                const materialUpdate = await SODMaterialService.processMaterialUsage(
                    tx, id, oldOrder.opmcId, contractorId, data.materialUsage!, InventoryService, userId
                );
                updateData.materialUsage = materialUpdate;
            }

            // Database update via Repository (Single Update)
            const updatedOrder = await ServiceOrderRepository.update(id, updateData, tx);

            console.log("=== SOD DEBUG STATE ===");
            console.log("updatedOrder.sltsStatus:", updatedOrder.sltsStatus);
            console.log("oldOrder.sltsStatus:", oldOrder.sltsStatus);
            console.log("hasMaterialUpdate:", hasMaterialUpdate);

            // Log material consumption & revenue in General Ledger on completion or adjustment
            const isCompletingNow = (updatedOrder.sltsStatus === 'COMPLETED' && oldOrder.sltsStatus !== 'COMPLETED');
            const isCompletedAdjustment = (updatedOrder.sltsStatus === 'COMPLETED' && oldOrder.sltsStatus === 'COMPLETED' && hasMaterialUpdate);

            if (isCompletingNow || isCompletedAdjustment) {
                const updatedWithUsages = await tx.serviceOrder.findUnique({
                    where: { id },
                    include: { materialUsage: true }
                });
                const usages = updatedWithUsages?.materialUsage || [];
                const totalSodMaterialCost = usages.reduce((sum, u) => sum + (Number(u.costPrice) * Number(u.quantity)), 0);
                
                // DR COGS, CR Inventory
                await LedgerService.logSodConsumption(tx, id, totalSodMaterialCost);
                
                // Only post revenue once on transition to Completed
                if (isCompletingNow && updatedOrder.revenueAmount) {
                    await LedgerService.logSodRevenue(tx, id, Number(updatedOrder.revenueAmount));
                }
            }

            // Post-update actions
            await SODLifecycleService.handlePostUpdate(oldOrder, updatedOrder, updateData, userId, tx);

            return updatedOrder;
        }, {
            timeout: 20000 // Increased timeout — RETURN path includes rollback operations
        });

        // 6. Audit Logging
        if (userId) {
            try {
                const { AuditService } = await import('../audit.service');
                await AuditService.log({
                    userId,
                    action: 'PATCH_UPDATE',
                    entity: 'ServiceOrder',
                    entityId: id,
                    oldValue: oldOrder,
                    newValue: finalOrder
                });
            } catch (e) {
                console.error('Audit logging failed:', e);
            }
        }

        return finalOrder;
    }

    // --- SYNC METHODS delegated to SODSyncService ---
    static async syncPatResults(opmcId: string, rtom: string) {
        return SODSyncService.syncPatResults(opmcId, rtom);
    }

    static async syncHoApprovedResults() {
        return SODSyncService.syncHoApprovedResults();
    }

    static async syncAllOpmcs() {
        return SODSyncService.syncAllOpmcs();
    }

    static async updateGlobalSyncStats(incremental: { created?: number; updated?: number; failed?: number }) {
        return SODSyncService.updateGlobalSyncStats(incremental);
    }

    static async syncServiceOrders(opmcId: string, rtom: string) {
        return SODSyncService.syncServiceOrders(opmcId, rtom);
    }

    static async getExtensionRawData(soNum: string) {
        return SODQueryService.getExtensionRawData(soNum);
    }

    static async getPatResults(params: {
        page?: number;
        limit?: number;
        search?: string;
        status?: string;
        rtom?: string;
        startDate?: string;
        endDate?: string;
    }) {
        return SODQueryService.getPatResults(params);
    }

    static async getOspFtthItems() {
        return SODQueryService.getOspFtthItems();
    }

    static async bulkImportLegacyServiceOrders(rows: any[], skipMaterials?: boolean) {
        return SODImportService.bulkImportLegacyServiceOrders(rows, skipMaterials);
    }

    static async bridgeSync(payload: any) {
        return SODSyncService.bridgeSync(payload);
    }
}
