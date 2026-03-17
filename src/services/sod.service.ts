import { prisma } from '@/lib/prisma';
import { ServiceOrder } from '@prisma/client';
import { TransactionClient } from './inventory/types';
import { SODQueryService } from './sod/sod.query.service';
import { SODInvoicingService } from './sod/sod.invoicing.service';
import { SODMaterialService } from './sod/sod.material.service';
import { SODLifecycleService } from './sod/sod.lifecycle.service';
import { SODSyncService } from './sod/sod.sync.service';
import { SODImportService } from './sod/sod.import.service';
import { GetServiceOrdersParams, ServiceOrderUpdateData } from './sod/sod-types';

/**
 * ServiceOrderService (Facade)
 * ----------------------------
 * This class now acts as a facade, delegating specific SOD logic to specialized sub-services:
 * - SODQueryService: Data fetching, filtering, and pagination.
 * - SODMaterialService: Material usage deductions and inventory management.
 * - SODInvoicingService: Billing, payments, and revenue calculations.
 * - SODLifecycleService: Status transitions, history, and notifications.
 * - SODSyncService: External SLT API synchronization.
 * - SODImportService: Bulk imports from Excel.
 */
export class ServiceOrderService {

    /**
     * Get all service orders with filtering and sorting
     */
    static async getServiceOrders(userId: string, params: GetServiceOrdersParams) {
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

        const oldOrder = await prisma.serviceOrder.findUnique({
            where: { id },
            include: { materialUsage: true }
        });
        if (!oldOrder) throw new Error('ORDER_NOT_FOUND');

        // 1. UNIQUE CONSTRAINT PROTECTION (Moved to Lifecycle)
        const collisionId = await SODLifecycleService.validateStatusTransition(id, oldOrder.soNum, data.status, oldOrder.status);
        if (collisionId) {
            console.warn(`[PATCH] Status collision detected for ${oldOrder.soNum}. Redirecting update.`);
            return this.patchServiceOrder(collisionId, { ...data, status: undefined }, userId);
        }

        // 2. Prepare Update Data
        const updateData = await SODLifecycleService.prepareStatusTransition(oldOrder, data);

        // 3. Financial calculations (Delegated to Invoicing Service)
        const isCompleting = updateData.sltsStatus === 'COMPLETED' || (oldOrder.sltsStatus !== 'COMPLETED' && data.sltsStatus === 'COMPLETED');
        if (isCompleting) {
            const distance = (updateData.dropWireDistance as number) ?? oldOrder.dropWireDistance ?? 0;
            const { revenueAmount, contractorAmount } = await SODInvoicingService.calculateAmounts(oldOrder.opmcId, distance);
            updateData.revenueAmount = revenueAmount;
            updateData.contractorAmount = contractorAmount;
        }

        // 4. TRANSACTIONAL DATABASE UPDATE
        const result = await prisma.$transaction(async (tx: TransactionClient) => {
            // Row lock for potential concurrent material updates
            await tx.$executeRaw`SELECT id FROM "ServiceOrder" WHERE id = ${id} FOR UPDATE`;

            // Material usage processing
            if (data.materialUsage && Array.isArray(data.materialUsage)) {
                const { InventoryService } = await import('./inventory.service');
                const contractorId = (data.contractorId || (updateData.contractorId as string | null) || oldOrder.contractorId) as string | null;
                
                const materialUpdate = await SODMaterialService.processMaterialUsage(
                    tx, id, oldOrder.opmcId, contractorId, data.materialUsage!, InventoryService, userId
                );
                updateData.materialUsage = materialUpdate;
            }

            // Database update
            const serviceOrder = await tx.serviceOrder.update({
                where: { id },
                data: updateData
            });

            // Post-update actions
            await SODLifecycleService.handlePostUpdate(oldOrder, serviceOrder, updateData, userId);

            return serviceOrder;
        }, {
            timeout: 10000 
        });

        const serviceOrder = result;

        // 7. Snapshots and Audit
        const configs: { value: string }[] = await prisma.$queryRaw`SELECT value FROM "SystemConfig" WHERE key = 'OSP_MATERIAL_SOURCE' LIMIT 1`;
        const currentSource = configs[0]?.value || 'SLT';
        await prisma.$executeRaw`UPDATE "ServiceOrder" SET "materialSource" = ${currentSource} WHERE "id" = ${id}`;

        if (userId) {
            try {
                const { AuditService } = await import('./audit.service');
                await AuditService.log({
                    userId,
                    action: 'PATCH_UPDATE',
                    entity: 'ServiceOrder',
                    entityId: id,
                    oldValue: oldOrder,
                    newValue: { ...serviceOrder, materialSource: currentSource }
                });
            } catch (e) {
                console.error('Audit logging failed:', e);
            }
        }

        return serviceOrder;
    }

    // --- SYNC METHODS (Delegated to SODSyncService) ---

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
