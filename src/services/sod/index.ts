import { ServiceOrder } from '@prisma/client';
import { TransactionClient } from '../inventory/types';
import { SODInvoicingService } from './sod.invoicing.service';
import { SODMaterialService } from './sod.material.service';
import { SODLifecycleService } from './sod.lifecycle.service';
import { SODSyncService } from './sod.sync.service';
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

        // 4. TRANSACTIONAL DATABASE UPDATE
        await prisma.$transaction(async (tx: TransactionClient) => {
            // Row lock
            await tx.$executeRaw`SELECT id FROM "ServiceOrder" WHERE id = ${id} FOR UPDATE`;

            // Material usage processing
            if (data.materialUsage && Array.isArray(data.materialUsage)) {
                const { InventoryService } = await import('../inventory');
                const contractorId = (data.contractorId || (updateData.contractorId as string | null) || oldOrder.contractorId) as string | null;
                
                const materialUpdate = await SODMaterialService.processMaterialUsage(
                    tx, id, oldOrder.opmcId, contractorId, data.materialUsage!, InventoryService, userId
                );
                updateData.materialUsage = materialUpdate;
            }

            // Database update via Repository
            const updatedOrder = await ServiceOrderRepository.update(id, updateData, tx);

            // Post-update actions
            await SODLifecycleService.handlePostUpdate(oldOrder, updatedOrder, updateData, userId);

            return updatedOrder;
        }, {
            timeout: 10000 
        });

        // 5. System specific manual updates (Snapshots)
        const configs: { value: string }[] = await prisma.$queryRaw`SELECT value FROM "SystemConfig" WHERE key = 'OSP_MATERIAL_SOURCE' LIMIT 1`;
        const currentSource = configs[0]?.value || 'SLT';
        
        // Final update via Repository
        const finalOrder = await ServiceOrderRepository.update(id, { materialSource: currentSource });

        if (userId) {
            try {
                const { AuditService } = await import('../audit.service');
                await AuditService.log({
                    userId,
                    action: 'PATCH_UPDATE',
                    entity: 'ServiceOrder',
                    entityId: id,
                    oldValue: oldOrder,
                    newValue: { ...finalOrder, materialSource: currentSource }
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
}
