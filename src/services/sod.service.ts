import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { sltApiService } from './slt-api.service';

export class ServiceOrderService {

    /**
     * Get all service orders with filtering and sorting
     */
    static async getServiceOrders(params: {
        rtomId: string;
        filter?: string;
        search?: string;
        statusFilter?: string;
        patFilter?: string;
        matFilter?: string;
        page?: number;
        limit?: number;
        month?: number;
        year?: number;
    }) {
        const { rtomId: opmcId, filter, search, statusFilter, patFilter, matFilter, page = 1, limit = 50, month, year } = params;
        const skip = (page - 1) * limit;

        if (!opmcId) {
            throw new Error('RTOM_ID_REQUIRED');
        }

        // Build where clause
        let whereClause: any = { opmcId };

        // Date Filtering
        if (month && year) {
            const startDate = new Date(year, month - 1, 1);
            const nextMonth = new Date(year, month, 1);

            if (patFilter === 'READY') {
                whereClause.hoPatDate = { gte: startDate, lt: nextMonth };
                whereClause.isInvoicable = true;
            } else if (filter === 'completed') {
                whereClause.completedDate = { gte: startDate, lt: nextMonth };
            } else if (filter === 'return') {
                whereClause.updatedAt = { gte: startDate, lt: nextMonth };
            } else {
                whereClause.createdAt = { gte: startDate, lt: nextMonth };
            }
        }

        // Status Filtering (Main View Tabs)
        if (filter === 'pending') {
            whereClause.sltsStatus = { notIn: ['COMPLETED', 'RETURN'] };
        } else if (filter === 'completed') {
            whereClause.sltsStatus = 'COMPLETED';
        } else if (filter === 'return') {
            whereClause.sltsStatus = 'RETURN';
        }

        // Sub-Filtering (Dropdowns/Search)
        if (search) {
            whereClause.OR = [
                { soNum: { contains: search, mode: 'insensitive' } },
                { customerName: { contains: search, mode: 'insensitive' } },
                { voiceNumber: { contains: search, mode: 'insensitive' } }
            ];
        }

        if (statusFilter && statusFilter !== 'ALL' && statusFilter !== 'DEFAULT') {
            whereClause.status = statusFilter;
        } else if (statusFilter === 'DEFAULT' && filter === 'pending') {
            whereClause.status = { in: ["ASSIGNED", "INPROGRESS", "PROV_CLOSED", "INSTALL_CLOSED"] };
        }

        if (patFilter && patFilter !== 'ALL') {
            if (patFilter === 'READY') {
                whereClause.isInvoicable = true;
            } else if (patFilter === 'OPMC_REJECTED') {
                whereClause.opmcPatStatus = 'REJECTED';
            } else if (patFilter === 'HO_REJECTED') {
                whereClause.hoPatStatus = 'REJECTED';
            } else if (patFilter === 'HO_PASS' || patFilter === 'PASS') {
                whereClause.hoPatStatus = 'PASS';
            } else if (patFilter === 'SLTS_PASS') {
                whereClause.sltsPatStatus = 'PASS';
            } else if (patFilter === 'PENDING') {
                whereClause.isInvoicable = false;
                whereClause.hoPatStatus = 'PENDING';
            }
        }

        if (matFilter && matFilter !== 'ALL') {
            const isMatPending = matFilter === 'PENDING';
            if (isMatPending) {
                whereClause.comments = { not: { contains: '[MATERIAL_COMPLETED]' } };
            } else {
                whereClause.comments = { contains: '[MATERIAL_COMPLETED]' };
            }
        }

        // Determine sort order
        let orderBy: any = { createdAt: 'desc' };
        if (filter === 'completed') {
            orderBy = { completedDate: 'desc' };
        } else if (filter === 'return') {
            orderBy = { updatedAt: 'desc' };
        }

        // Run queries in parallel
        const [total, items, statusGroups, contractorCount, appointmentCount] = await Promise.all([
            prisma.serviceOrder.count({ where: whereClause }),
            prisma.serviceOrder.findMany({
                where: whereClause,
                select: {
                    id: true,
                    rtom: true,
                    lea: true,
                    soNum: true,
                    voiceNumber: true,
                    orderType: true,
                    serviceType: true,
                    customerName: true,
                    techContact: true,
                    status: true,
                    sltsStatus: true,
                    completedDate: true,
                    contractorId: true,
                    contractor: { select: { name: true } },
                    comments: true,
                    opmcPatStatus: true,
                    opmcPatDate: true,
                    sltsPatStatus: true,
                    sltsPatDate: true,
                    hoPatStatus: true,
                    hoPatDate: true,
                    isInvoicable: true,
                    invoiced: true,
                    package: true,
                    address: true,
                    dp: true,
                    iptv: true,
                    revenueAmount: true,
                    contractorAmount: true,
                    dropWireDistance: true,
                    createdAt: true,
                    materialUsage: {
                        select: {
                            quantity: true,
                            unitPrice: true,
                            costPrice: true
                        } as any
                    }
                },
                orderBy,
                skip,
                take: limit
            }),
            prisma.serviceOrder.groupBy({
                by: ['status'],
                where: whereClause,
                _count: true
            }),
            prisma.serviceOrder.count({
                where: {
                    ...whereClause,
                    contractorId: { not: null }
                }
            }),
            prisma.serviceOrder.count({
                where: {
                    ...whereClause,
                    scheduledDate: { not: null }
                }
            })
        ]);

        return {
            items,
            meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
            summary: {
                totalSod: total,
                contractorAssigned: contractorCount,
                appointments: appointmentCount,
                statusBreakdown: statusGroups.reduce((acc, curr) => {
                    acc[curr.status] = curr._count;
                    return acc;
                }, {} as Record<string, number>)
            }
        };
    }

    /**
     * Patch Update (Status Change, Completion, etc.)
     */
    static async patchServiceOrder(id: string, data: any, userId?: string) {
        if (!id) throw new Error('ID_REQUIRED');

        const oldOrder = await prisma.serviceOrder.findUnique({
            where: { id },
            include: { materialUsage: true }
        });
        if (!oldOrder) throw new Error('ORDER_NOT_FOUND');

        const { sltsStatus, completedDate, contractorId, comments, ...otherData } = data;
        const updateData: any = {};

        if (sltsStatus) {
            if (!['INPROGRESS', 'COMPLETED', 'RETURN'].includes(sltsStatus)) throw new Error('INVALID_STATUS');
            updateData.sltsStatus = sltsStatus;
            if ((sltsStatus === 'COMPLETED' || sltsStatus === 'RETURN') && !completedDate) throw new Error('COMPLETED_DATE_REQUIRED');
        }

        if (completedDate) updateData.completedDate = new Date(completedDate);
        if (contractorId !== undefined) updateData.contractorId = contractorId;
        if (comments !== undefined) updateData.comments = comments;

        // Completion fields mapping
        if (otherData.ontSerialNumber) updateData.ontSerialNumber = otherData.ontSerialNumber;
        if (otherData.iptvSerialNumbers) updateData.iptvSerialNumbers = Array.isArray(otherData.iptvSerialNumbers) ? JSON.stringify(otherData.iptvSerialNumbers) : otherData.iptvSerialNumbers;
        if (otherData.dpDetails) updateData.dpDetails = otherData.dpDetails;
        if (otherData.teamId) updateData.teamId = otherData.teamId || null;
        if (otherData.directTeamName) updateData.directTeam = otherData.directTeamName;
        if (otherData.dropWireDistance !== undefined) updateData.dropWireDistance = parseFloat(otherData.dropWireDistance || '0');

        // Capture Snapshots at Completion
        if (updateData.sltsStatus === 'COMPLETED' || (oldOrder.sltsStatus !== 'COMPLETED' && sltsStatus === 'COMPLETED')) {
            const rtomId = oldOrder.opmcId;
            const distance = updateData.dropWireDistance ?? oldOrder.dropWireDistance ?? 0;

            // 1. Calculate Revenue (Flat Rate per RTOM)
            const revConfig = await (prisma as any).sODRevenueConfig.findFirst({
                where: { OR: [{ rtomId }, { rtomId: null }], isActive: true },
                orderBy: { rtomId: { sort: 'asc', nulls: 'last' } } // Specific RTOM first
            });
            if (revConfig) updateData.revenueAmount = revConfig.revenuePerSOD;

            // 2. Calculate Contractor Payment (Tiered Distance)
            const payConfig = await (prisma as any).contractorPaymentConfig.findFirst({
                where: { OR: [{ rtomId }, { rtomId: null }], isActive: true },
                include: { tiers: true },
                orderBy: { rtomId: { sort: 'asc', nulls: 'last' } }
            });

            if (payConfig && payConfig.tiers && payConfig.tiers.length > 0) {
                const matchingTier = payConfig.tiers.find((t: any) =>
                    distance >= t.minDistance && distance <= t.maxDistance
                );
                if (matchingTier) {
                    updateData.contractorAmount = matchingTier.amount;
                } else {
                    // Fallback to highest tier if over distance mentioned
                    const sortedTiers = [...payConfig.tiers].sort((a: any, b: any) => b.maxDistance - a.maxDistance);
                    if (distance > sortedTiers[0].maxDistance) {
                        updateData.contractorAmount = sortedTiers[0].amount;
                    }
                }
            }
        }

        // PAT Updates from UI
        if (otherData.sltsPatStatus) {
            updateData.sltsPatStatus = otherData.sltsPatStatus;
            if (otherData.sltsPatStatus === 'PASS' && oldOrder.sltsPatStatus !== 'PASS') {
                updateData.sltsPatDate = new Date();
            }
        }
        if (otherData.opmcPatStatus) {
            updateData.opmcPatStatus = otherData.opmcPatStatus;
            if (otherData.opmcPatStatus === 'PASS' && oldOrder.opmcPatStatus !== 'PASS') {
                updateData.opmcPatDate = new Date();
            }
        }
        if (otherData.hoPatStatus) {
            updateData.hoPatStatus = otherData.hoPatStatus;
            if (otherData.hoPatStatus === 'PASS' && oldOrder.hoPatStatus !== 'PASS') {
                updateData.hoPatDate = new Date();
            }
        }

        // IMPORTANT: Invoicable logic - A connection becomes eligible for Invoice (Part A)
        // as soon as SLTS PAT is passed by the QC Officer.
        const finalizedSlts = updateData.sltsPatStatus || oldOrder.sltsPatStatus;
        updateData.isInvoicable = (finalizedSlts === 'PASS');

        // Material Source Snapshot
        const configs: any[] = await prisma.$queryRaw`SELECT value FROM "SystemConfig" WHERE key = 'OSP_MATERIAL_SOURCE' LIMIT 1`;
        const currentSource = configs[0]?.value || 'SLT';

        const { InventoryService } = await import('./inventory.service');

        // Material Usage deduction & save
        if (otherData.materialUsage && Array.isArray(otherData.materialUsage)) {
            // Fetch material metadata to snapshot prices
            const itemIds = otherData.materialUsage.map((m: any) => m.itemId);
            const itemMetadata = await prisma.inventoryItem.findMany({
                where: { id: { in: itemIds } },
                select: { id: true, unitPrice: true, costPrice: true } as any
            });

            await prisma.$transaction(async (tx) => {
                const targetContractorId = contractorId || updateData.contractorId || oldOrder.contractorId;
                const finalUsageRecords = [];

                if (targetContractorId) {
                    for (const m of otherData.materialUsage) {
                        const qty = parseFloat(m.quantity);
                        if (['USED', 'WASTAGE', 'USED_F1', 'USED_G1'].includes(m.usageType)) {
                            // A. Pick batches FIFO from Contractor
                            const pickedBatches = await InventoryService.pickContractorBatchesFIFO(tx, targetContractorId, m.itemId, qty);

                            for (const picked of pickedBatches) {
                                // B. Reduce from Contractor Batch Stock
                                await (tx as any).contractorBatchStock.update({
                                    where: { contractorId_batchId: { contractorId: targetContractorId, batchId: picked.batchId } },
                                    data: { quantity: { decrement: picked.quantity } }
                                });

                                // C. Create Usage Record for this Batch
                                finalUsageRecords.push({
                                    itemId: m.itemId,
                                    batchId: picked.batchId,
                                    quantity: picked.quantity,
                                    unit: m.unit || 'Nos',
                                    usageType: m.usageType || 'USED',
                                    unitPrice: picked.batch.unitPrice || 0,
                                    costPrice: picked.batch.costPrice || 0,
                                    wastagePercent: m.wastagePercent ? parseFloat(m.wastagePercent) : null,
                                    exceedsLimit: m.exceedsLimit || false,
                                    comment: m.comment,
                                    serialNumber: m.serialNumber
                                });
                            }

                            // D. Update Global Contractor Stock (Legacy)
                            await tx.contractorStock.upsert({
                                where: { contractorId_itemId: { contractorId: targetContractorId, itemId: m.itemId } },
                                create: { contractorId: targetContractorId, itemId: m.itemId, quantity: -qty },
                                update: { quantity: { decrement: qty } }
                            });
                        } else {
                            // Non-deductible items (if any, still record them)
                            const meta = itemMetadata.find((i: any) => i.id === m.itemId);
                            finalUsageRecords.push({
                                itemId: m.itemId,
                                quantity: qty,
                                unit: m.unit || 'Nos',
                                usageType: m.usageType || 'USED',
                                unitPrice: (meta as any)?.unitPrice || 0,
                                costPrice: (meta as any)?.costPrice || 0,
                                wastagePercent: m.wastagePercent ? parseFloat(m.wastagePercent) : null,
                                exceedsLimit: m.exceedsLimit || false,
                                comment: m.comment,
                                serialNumber: m.serialNumber
                            });
                        }
                    }
                } else {
                    // No contractor (direct team) - Deduct from Store Stock
                    // Get store for this OPMC
                    const opmc = await tx.oPMC.findUnique({
                        where: { id: oldOrder.opmcId },
                        select: { storeId: true }
                    });

                    if (opmc?.storeId) {
                        for (const m of otherData.materialUsage) {
                            const qty = parseFloat(m.quantity);
                            if (['USED', 'WASTAGE', 'USED_F1', 'USED_G1'].includes(m.usageType)) {
                                // A. Pick batches FIFO from Store
                                const pickedBatches = await InventoryService.pickStoreBatchesFIFO(tx, opmc.storeId, m.itemId, qty);

                                for (const picked of pickedBatches) {
                                    // B. Reduce from Store Batch Stock
                                    await (tx as any).inventoryBatchStock.update({
                                        where: { storeId_batchId: { storeId: opmc.storeId!, batchId: picked.batchId } },
                                        data: { quantity: { decrement: picked.quantity } }
                                    });

                                    // C. Create Usage Record for this Batch
                                    finalUsageRecords.push({
                                        itemId: m.itemId,
                                        batchId: picked.batchId,
                                        quantity: picked.quantity,
                                        unit: m.unit || 'Nos',
                                        usageType: m.usageType || 'USED',
                                        unitPrice: picked.batch.unitPrice || 0,
                                        costPrice: picked.batch.costPrice || 0,
                                        wastagePercent: m.wastagePercent ? parseFloat(m.wastagePercent) : null,
                                        exceedsLimit: m.exceedsLimit || false,
                                        comment: m.comment,
                                        serialNumber: m.serialNumber
                                    });
                                }

                                // D. Update Global Store Stock (Legacy)
                                await tx.inventoryStock.update({
                                    where: { storeId_itemId: { storeId: opmc.storeId!, itemId: m.itemId } },
                                    data: { quantity: { decrement: qty } }
                                });
                            } else {
                                const meta = itemMetadata.find((i: any) => i.id === m.itemId);
                                finalUsageRecords.push({
                                    itemId: m.itemId,
                                    quantity: qty,
                                    unit: m.unit || 'Nos',
                                    usageType: m.usageType || 'USED',
                                    unitPrice: (meta as any)?.unitPrice || 0,
                                    costPrice: (meta as any)?.costPrice || 0,
                                    wastagePercent: m.wastagePercent ? parseFloat(m.wastagePercent) : null,
                                    exceedsLimit: m.exceedsLimit || false,
                                    comment: m.comment,
                                    serialNumber: m.serialNumber
                                });
                            }
                        }
                    }
                }

                await tx.sODMaterialUsage.deleteMany({ where: { serviceOrderId: id } });
                updateData.materialUsage = {
                    create: finalUsageRecords
                };
            });
        }

        const serviceOrder = await prisma.serviceOrder.update({
            where: { id },
            data: updateData
        });

        // Manual Raw update for materialSource
        await prisma.$executeRaw`UPDATE "ServiceOrder" SET "materialSource" = ${currentSource} WHERE "id" = ${id}`;

        if (userId) {
            const { AuditService } = await import('./audit.service');
            await AuditService.log({
                userId,
                action: 'PATCH_UPDATE',
                entity: 'ServiceOrder',
                entityId: id,
                oldValue: oldOrder,
                newValue: { ...serviceOrder, materialSource: currentSource }
            });
        }

        return serviceOrder;
    }

    /**
     * Sync PAT Results from SLT (Multi-source)
     */
    /**
     * Sync PAT Results from SLT (Multi-source) - Optimized with DB Caching
     */
    static async syncPatResults(opmcId: string, rtom: string, hoRejected: any[] = []) {
        if (!opmcId || !rtom) throw new Error('RTOM_AND_ID_REQUIRED');

        console.log(`[PAT-SYNC] Syncing Rejections for ${rtom}...`);

        // 1. Fetch OPMC Rejected (opmcpatrej) - RTOM specific
        const opmcRejected = await sltApiService.fetchOpmcRejected(rtom);

        // 2. Cache these entries in SLTPATStatus table
        // We Upsert them to ensure we have the latest rejected status
        for (const rej of opmcRejected) {
            await (prisma as any).sLTPATStatus.upsert({
                where: { soNum: rej.SO_NUM },
                update: { status: 'REJECTED', source: 'OPMC_REJECTED', statusDate: sltApiService.parseStatusDate(rej.CON_STATUS_DATE), updatedAt: new Date() },
                create: { soNum: rej.SO_NUM, status: 'REJECTED', source: 'OPMC_REJECTED', rtom, statusDate: sltApiService.parseStatusDate(rej.CON_STATUS_DATE) }
            });
        }

        const rtHoRejected = hoRejected.filter((p: any) => p.RTOM === rtom);
        for (const rej of rtHoRejected) {
            await (prisma as any).sLTPATStatus.upsert({
                where: { soNum: rej.SO_NUM },
                update: { status: 'REJECTED', source: 'HO_REJECTED', statusDate: sltApiService.parseStatusDate(rej.CON_STATUS_DATE), updatedAt: new Date() },
                create: { soNum: rej.SO_NUM, status: 'REJECTED', source: 'HO_REJECTED', rtom, statusDate: sltApiService.parseStatusDate(rej.CON_STATUS_DATE) }
            });
        }

        // 3. Clear 'REJECTED' status in Our DB (ServiceOrder) if no longer in API rejected list
        // and NOT in Approved list.
        const previouslyRejected = await prisma.serviceOrder.findMany({
            where: {
                opmcId,
                sltsStatus: 'COMPLETED', // Only update if manually completed
                OR: [{ opmcPatStatus: 'REJECTED' }, { hoPatStatus: 'REJECTED' }]
            },
            select: { id: true, soNum: true, opmcPatStatus: true, hoPatStatus: true }
        });

        let updated = 0;
        for (const order of previouslyRejected) {
            const isOpmcRej = opmcRejected.some(r => r.SO_NUM === order.soNum);
            const isHoRej = rtHoRejected.some(r => r.SO_NUM === order.soNum);

            const updateObj: any = {};
            if (!isOpmcRej && order.opmcPatStatus === 'REJECTED') updateObj.opmcPatStatus = 'PENDING';
            if (!isHoRej && order.hoPatStatus === 'REJECTED') updateObj.hoPatStatus = 'PENDING';

            if (Object.keys(updateObj).length > 0) {
                await prisma.serviceOrder.update({ where: { id: order.id }, data: updateObj });
                updated++;
            }
        }

        // 4. Update ServiceOrder table from cached SLTPATStatus for this RTOM
        const cachedRejections = await (prisma as any).sLTPATStatus.findMany({
            where: { rtom, status: 'REJECTED' }
        });

        for (const rej of cachedRejections) {
            const order = await prisma.serviceOrder.findFirst({
                where: { soNum: rej.soNum, opmcId, sltsStatus: 'COMPLETED' }
            });
            if (order) {
                const update: any = {};
                if (rej.source === 'OPMC_REJECTED' && order.opmcPatStatus !== 'REJECTED') {
                    update.opmcPatStatus = 'REJECTED';
                    update.opmcPatDate = rej.statusDate;
                }
                if (rej.source === 'HO_REJECTED' && order.hoPatStatus !== 'REJECTED') {
                    update.hoPatStatus = 'REJECTED';
                    update.hoPatDate = rej.statusDate;
                }
                if (Object.keys(update).length > 0) {
                    await prisma.serviceOrder.update({ where: { id: order.id }, data: update });
                    updated++;
                }
            }
        }

        return { rtom, updated };
    }

    /**
     * All the rest of the sync methods from previous version...
     */
    static async syncAllPatResults() {
        const opmcs = await prisma.oPMC.findMany({ select: { id: true, rtom: true } });

        // Fetch HO Rejected ONCE (Global API)
        console.log('[PAT-SYNC] Fetching global HO Rejected list...');
        const hoRejected = await sltApiService.fetchHORejected();

        let totalUpdated = 0;
        for (const opmc of opmcs) {
            try {
                const res = await this.syncPatResults(opmc.id, opmc.rtom, hoRejected);
                totalUpdated += res.updated;
            } catch (err) { console.error(`PAT/Rejection Sync failed for ${opmc.rtom}:`, err); }
        }

        // Run HO Approved Sync Separately (Optimized for 100k records)
        const hoApprovedStats = await this.syncHoApprovedResults();

        return { totalUpdated, hoApproved: hoApprovedStats };
    }

    /**
     * Optimized HO Approved Sync with DB Caching
     * Handles 100k+ records by using bulk DB operations
     */
    static async syncHoApprovedResults() {
        console.log('[PAT-SYNC] Starting optimized HO Approved sync with bulk cache...');

        // Fetch RTOMs where we have pending work
        const pendingRtoms = await prisma.serviceOrder.findMany({
            where: { hoPatStatus: { not: 'PASS' } },
            select: { rtom: true },
            distinct: ['rtom']
        });

        let updated = 0;
        for (const { rtom } of pendingRtoms) {
            try {
                console.log(`[PAT-SYNC] Fetching HO Approved for ${rtom}...`);
                const apiApproved = await sltApiService.fetchPATResults(rtom);
                if (apiApproved.length === 0) continue;

                // 1. Bulk Cache into SLTPATStatus
                const cacheData = apiApproved.map(app => ({
                    soNum: app.SO_NUM,
                    status: 'PASS',
                    source: 'HO_APPROVED',
                    rtom,
                    statusDate: sltApiService.parseStatusDate(app.CON_STATUS_DATE)
                }));

                // High performance bulk create (skip existing to avoid O(N^2) upsert)
                await (prisma as any).sLTPATStatus.createMany({
                    data: cacheData,
                    skipDuplicates: true
                });

                // 2. Update Our ServiceOrders for this RTOM
                const ordersToUpdate = await prisma.serviceOrder.findMany({
                    where: {
                        rtom,
                        sltsStatus: 'COMPLETED', // ONLY update if manually completed by us
                        hoPatStatus: { not: 'PASS' },
                        soNum: { in: apiApproved.map(a => a.SO_NUM) }
                    }
                });

                for (const order of ordersToUpdate) {
                    const match = apiApproved.find(a => a.SO_NUM === order.soNum);
                    if (match) {
                        const finalOrder = await prisma.serviceOrder.update({
                            where: { id: order.id },
                            data: {
                                hoPatStatus: 'PASS',
                                hoPatDate: sltApiService.parseStatusDate(match.CON_STATUS_DATE),
                                opmcPatStatus: 'PASS'
                            }
                        });

                        // Re-check Invoicable: Only SLTS PAT PASS is required for Invoice Eligibility
                        const canInvoice = finalOrder.sltsPatStatus === 'PASS';
                        if (canInvoice !== (finalOrder as any).isInvoicable) {
                            await prisma.serviceOrder.update({ where: { id: order.id }, data: { isInvoicable: canInvoice } });
                        }
                        updated++;
                    }
                }
            } catch (err) {
                console.error(`[PAT-SYNC] HO Approved Batch Sync failed for ${rtom}:`, err);
            }
        }

        return { updated };
    }

    static async syncAllOpmcs() {
        const opmcs = await prisma.oPMC.findMany({ select: { id: true, rtom: true } });
        const results: any[] = [];
        let created = 0;
        let updated = 0;
        let failed = 0;

        for (const opmc of opmcs) {
            try {
                const res = await (this as any).syncServiceOrders(opmc.id, opmc.rtom);
                results.push({ rtom: opmc.rtom, ...res });
                created += res.created || 0;
                updated += res.updated || 0;
            } catch (err) {
                results.push({ rtom: opmc.rtom, error: (err as any).message });
                failed++;
            }
        }
        const patSync = await this.syncAllPatResults();
        const finalStats = {
            patUpdated: patSync.totalUpdated,
            created,
            updated,
            failed,
            lastSync: new Date().toISOString()
        };

        // Update System Setting for Frontend
        try {
            await (prisma as any).systemSetting.upsert({
                where: { key: 'LAST_SYNC_STATS' },
                update: { value: finalStats },
                create: { key: 'LAST_SYNC_STATS', value: finalStats }
            });
        } catch (e) {
            console.error('Failed to update sync stats in DB:', e);
        }

        return { patSync, stats: finalStats, details: results };
    }

    static async syncServiceOrders(opmcId: string, rtom: string) {
        const sltData = await sltApiService.fetchServiceOrders(rtom);
        if (!sltData || sltData.length === 0) return { created: 0, updated: 0 };
        const sltSoNums = sltData.map(item => item.SO_NUM);
        const lockedSods = await prisma.serviceOrder.findMany({
            where: { soNum: { in: sltSoNums }, sltsStatus: { in: ['COMPLETED', 'RETURN'] } },
            select: { soNum: true }
        });
        const lockedSoNums = new Set(lockedSods.map(s => s.soNum));
        const syncableData = sltData.filter(item => !lockedSoNums.has(item.SO_NUM));

        let created = 0; let updated = 0;
        const batchSize = 25;
        for (let i = 0; i < syncableData.length; i += batchSize) {
            const batch = syncableData.slice(i, i + batchSize);
            const results = await Promise.all(batch.map(async (item) => {
                const statusDate = sltApiService.parseStatusDate(item.CON_STATUS_DATE);
                return await prisma.serviceOrder.upsert({
                    where: { soNum_status: { soNum: item.SO_NUM, status: item.CON_STATUS } },
                    update: { lea: item.LEA, voiceNumber: item.VOICENUMBER, orderType: item.ORDER_TYPE, serviceType: item.S_TYPE, customerName: item.CON_CUS_NAME, techContact: item.CON_TEC_CONTACT, statusDate, address: item.ADDRE, dp: item.DP, package: item.PKG },
                    create: { opmcId, rtom: item.RTOM, lea: item.LEA, soNum: item.SO_NUM, voiceNumber: item.VOICENUMBER, orderType: item.ORDER_TYPE, serviceType: item.S_TYPE, customerName: item.CON_CUS_NAME, techContact: item.CON_TEC_CONTACT, status: item.CON_STATUS, statusDate, address: item.ADDRE, dp: item.DP, package: item.PKG, sltsStatus: 'INPROGRESS' }
                });
            }));
            results.forEach(r => { if (r?.createdAt.getTime() === r?.updatedAt.getTime()) created++; else updated++; });
        }
        return { created, updated };
    }
}
