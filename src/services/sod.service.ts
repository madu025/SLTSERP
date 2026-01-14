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
                        }
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

        // IMPORTANT: Invoicable logic - Only if SLTS Pass AND HO Pass
        const finalizedSlts = updateData.sltsPatStatus || oldOrder.sltsPatStatus;
        const finalizedHo = updateData.hoPatStatus || oldOrder.hoPatStatus;
        updateData.isInvoicable = (finalizedSlts === 'PASS' && finalizedHo === 'PASS');

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
                select: { id: true, unitPrice: true, costPrice: true }
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
                                await tx.contractorBatchStock.update({
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
                                unitPrice: meta?.unitPrice || 0,
                                costPrice: meta?.costPrice || 0,
                                wastagePercent: m.wastagePercent ? parseFloat(m.wastagePercent) : null,
                                exceedsLimit: m.exceedsLimit || false,
                                comment: m.comment,
                                serialNumber: m.serialNumber
                            });
                        }
                    }
                } else {
                    // No contractor (direct team) - still record usage
                    for (const m of otherData.materialUsage) {
                        const meta = itemMetadata.find((i: any) => i.id === m.itemId);
                        finalUsageRecords.push({
                            itemId: m.itemId,
                            quantity: parseFloat(m.quantity),
                            unit: m.unit || 'Nos',
                            usageType: m.usageType || 'USED',
                            unitPrice: meta?.unitPrice || 0,
                            costPrice: meta?.costPrice || 0,
                            wastagePercent: m.wastagePercent ? parseFloat(m.wastagePercent) : null,
                            exceedsLimit: m.exceedsLimit || false,
                            comment: m.comment,
                            serialNumber: m.serialNumber
                        });
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
    static async syncPatResults(opmcId: string, rtom: string) {
        if (!opmcId || !rtom) throw new Error('RTOM_AND_ID_REQUIRED');

        console.log(`[PAT-SYNC] Syncing for ${rtom}...`);

        // 1. Fetch HO Approved (patreslt)
        const hoApproved = await sltApiService.fetchPATResults(rtom);

        // 2. Fetch OPMC Rejected (opmcpatrej)
        const opmcRejected = await sltApiService.fetchOpmcRejected(rtom);

        // 3. Fetch HO Rejected (patreject)
        const hoRejected = await sltApiService.fetchHORejected();

        const allSoNums = Array.from(new Set([
            ...hoApproved.map(p => p.SO_NUM),
            ...opmcRejected.map(p => p.SO_NUM),
            ...hoRejected.filter(p => p.RTOM === rtom).map(p => p.SO_NUM)
        ]));

        if (allSoNums.length === 0) return { rtom, updated: 0 };

        const existingOrders = await prisma.serviceOrder.findMany({
            where: { soNum: { in: allSoNums }, opmcId },
            select: { id: true, soNum: true, sltsPatStatus: true, hoPatStatus: true, opmcPatStatus: true }
        });

        let updated = 0;
        for (const order of existingOrders) {
            const updateObj: any = {};
            const isHoApproved = hoApproved.find(p => p.SO_NUM === order.soNum);
            const isOpmcRejected = opmcRejected.find(p => p.SO_NUM === order.soNum);
            const isHoRejected = hoRejected.find(p => p.SO_NUM === order.soNum);

            // Logic: HO PASS > HO REJECTED > OPMC REJECTED
            if (isHoApproved) {
                if (order.hoPatStatus !== 'PASS') {
                    updateObj.hoPatStatus = 'PASS';
                    updateObj.hoPatDate = sltApiService.parseStatusDate(isHoApproved.CON_STATUS_DATE) || new Date();
                    // If HO passes, OPMC must have passed too (or at least no longer rejected)
                    updateObj.opmcPatStatus = 'PASS';
                }
            } else if (isHoRejected) {
                if (order.hoPatStatus !== 'REJECTED') {
                    updateObj.hoPatStatus = 'REJECTED';
                    updateObj.hoPatDate = sltApiService.parseStatusDate(isHoRejected.CON_STATUS_DATE) || new Date();
                }
            } else if (isOpmcRejected) {
                if (order.opmcPatStatus !== 'REJECTED') {
                    updateObj.opmcPatStatus = 'REJECTED';
                    updateObj.opmcPatDate = sltApiService.parseStatusDate(isOpmcRejected.CON_STATUS_DATE) || new Date();
                }
            }

            if (Object.keys(updateObj).length > 0) {
                const finalOrder = await prisma.serviceOrder.update({
                    where: { id: order.id },
                    data: updateObj
                });

                // Recalculate isInvoicable: SLTS PASS and HO PASS
                const canInvoice = finalOrder.sltsPatStatus === 'PASS' && finalOrder.hoPatStatus === 'PASS';
                if (canInvoice !== finalOrder.isInvoicable) {
                    await prisma.serviceOrder.update({
                        where: { id: order.id },
                        data: { isInvoicable: canInvoice }
                    });
                }
                updated++;
            }
        }

        return { rtom, updated };
    }

    /**
     * All the rest of the sync methods from previous version...
     */
    static async syncAllPatResults() {
        const opmcs = await prisma.oPMC.findMany({ select: { id: true, rtom: true } });
        let totalUpdated = 0;
        for (const opmc of opmcs) {
            try {
                const res = await this.syncPatResults(opmc.id, opmc.rtom);
                totalUpdated += res.updated;
            } catch (err) { console.error(`PAT Bulk Sync failed for ${opmc.rtom}:`, err); }
        }
        return { totalUpdated };
    }

    static async syncAllOpmcs() {
        const opmcs = await prisma.oPMC.findMany({ select: { id: true, rtom: true } });
        const results: any[] = [];
        for (const opmc of opmcs) {
            try {
                const res = await (this as any).syncServiceOrders(opmc.id, opmc.rtom);
                results.push({ rtom: opmc.rtom, ...res });
            } catch (err) { results.push({ rtom: opmc.rtom, error: (err as any).message }); }
        }
        const patSync = await this.syncAllPatResults();
        return { patSync, stats: { patUpdated: patSync.totalUpdated } };
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
