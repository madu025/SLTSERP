import { AppError } from '@/lib/error';
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
        if (!id) throw AppError.badRequest('ID_REQUIRED');

        const oldOrder = await ServiceOrderRepository.findById(id, { materialUsage: true });
        if (!oldOrder) throw AppError.badRequest('ORDER_NOT_FOUND');

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

            // Save collected CPEs
            if (data.collectedCpes && Array.isArray(data.collectedCpes)) {
                const contractorId = (data.contractorId || (updateData.contractorId as string | null) || oldOrder.contractorId) as string | null;
                if (contractorId) {
                    await tx.collectedCPE.deleteMany({
                        where: { serviceOrderId: id }
                    });
                    if (data.collectedCpes.length > 0) {
                        await tx.collectedCPE.createMany({
                            data: data.collectedCpes.map(c => ({
                                serviceOrderId: id,
                                contractorId,
                                deviceType: c.deviceType,
                                serialNumber: c.serialNumber,
                                condition: c.condition,
                                status: "PENDING_HANDBACK"
                            }))
                        });
                    }
                }
            }
            // Save erected poles
            if (data.erectedPoles !== undefined) {
                const erectedPoles = data.erectedPoles;

                await tx.sODErectedPole.deleteMany({
                    where: { serviceOrderId: id }
                });
                if (erectedPoles && erectedPoles.length > 0) {
                    await tx.sODErectedPole.createMany({
                        data: erectedPoles.map(p => ({
                            serviceOrderId: id,
                            poleType: p.poleType,
                            poleNumber: p.poleNumber
                        }))
                    });
                }
            }
            // Save IPTV serials relationally
            if (data.iptvSerialNumbers !== undefined) {
                const serials = data.iptvSerialNumbers || [];
                await tx.sODIptvSerial.deleteMany({
                    where: { serviceOrderId: id }
                });
                if (serials.length > 0) {
                    await tx.sODIptvSerial.createMany({
                        data: serials.map(sn => ({
                            serviceOrderId: id,
                            serialNumber: sn
                        }))
                    });
                }
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

                // Accrue Contractor Payable/Expense once on transition to Completed
                if (isCompletingNow && updatedOrder.contractorAmount) {
                    const contractor = updatedOrder.contractorId 
                        ? await tx.contractor.findUnique({ where: { id: updatedOrder.contractorId } })
                        : null;
                    const contractorName = contractor?.name || 'Unknown Contractor';
                    await LedgerService.logContractorAccrual(tx, id, Number(updatedOrder.contractorAmount), contractorName);
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

    static async syncHoRejectedResults() {
        return SODSyncService.syncHoRejectedResults();
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
        region?: string;
        startDate?: string;
        endDate?: string;
    }) {
        return SODQueryService.getPatResults(params);
    }

    static async getOspFtthItems() {
        return SODQueryService.getOspFtthItems();
    }

    static async bulkImportLegacyServiceOrders(
        rows: Parameters<typeof SODImportService.bulkImportLegacyServiceOrders>[0], 
        skipMaterials?: boolean
    ) {
        return SODImportService.bulkImportLegacyServiceOrders(rows, skipMaterials);
    }
 
    static async bridgeSync(payload: Parameters<typeof SODSyncService.bridgeSync>[0]) {
        return SODSyncService.bridgeSync(payload);
    }

    /**
     * One-off maintenance script to fix completed dates
     */
    static async fixDates(execute: boolean) {
        const targetTime = new Date('2026-01-28T18:30:00.000Z');

        const suspectOrders = await prisma.serviceOrder.findMany({
            where: {
                status: 'COMPLETED',
                completedDate: {
                    gte: targetTime
                }
            },
            select: {
                id: true,
                soNum: true,
                completedDate: true,
                updatedAt: true
            }
        });

        if (!execute) {
            return {
                message: "Dry Run: Found suspect orders. Add '?execute=true' to apply fix.",
                count: suspectOrders.length,
                samples: suspectOrders.slice(0, 5).map(o => ({
                    soNum: o.soNum,
                    currentDate: o.completedDate,
                    proposedFix: o.completedDate ? new Date(o.completedDate.getTime() - 330 * 60000) : null
                }))
            };
        }

        let fixedCount = 0;
        for (const order of suspectOrders) {
            if (order.completedDate) {
                const newDate = new Date(order.completedDate.getTime() - 330 * 60000);

                await prisma.serviceOrder.update({
                    where: { id: order.id },
                    data: {
                        completedDate: newDate
                    }
                });
                fixedCount++;
            }
        }

        return {
            success: true,
            message: "Successfully adjusted timestamps.",
            fixedCount
        };
    }

    /**
     * Test/Debug method for syncing a specific SO
     */
    static async debugSync(soNum: string) {
        const raw = await prisma.extensionRawData.findFirst({
            where: { soNum }
        });
        if (!raw) throw AppError.notFound('No raw data');

        await this.bridgeSync(raw.scrapedData as any);
        
        const so = await prisma.serviceOrder.findUnique({
            where: { soNum },
            select: { dropWireDistance: true, ontSerialNumber: true, teamId: true }
        });

        return so;
    }

    /**
     * Store Extension Raw Data
     */
    static async saveExtensionRawData(soNum: string | null, body: any) {
        if (soNum) {
            const existing = await prisma.extensionRawData.findFirst({
                where: { soNum: soNum }
            });

            if (existing) {
                return prisma.extensionRawData.update({
                    where: { id: existing.id },
                    data: {
                        sltUser: body.currentUser || null,
                        activeTab: body.activeTab || null,
                        url: body.url || null,
                        scrapedData: body,
                    }
                });
            } else {
                return prisma.extensionRawData.create({
                    data: {
                        soNum: soNum,
                        sltUser: body.currentUser || null,
                        activeTab: body.activeTab || null,
                        url: body.url || null,
                        scrapedData: body,
                    }
                });
            }
        } else {
            return prisma.extensionRawData.create({
                data: {
                    soNum: null,
                    sltUser: body.currentUser || null,
                    activeTab: body.activeTab || null,
                    url: body.url || null,
                    scrapedData: body,
                }
            });
        }
    }

    static async getExtensionLogs() {
        return prisma.extensionRawData.findMany({
            orderBy: { updatedAt: 'desc' },
            take: 100
        });
    }

    static async clearExtensionLogs() {
        return prisma.extensionRawData.deleteMany({});
    }
}
