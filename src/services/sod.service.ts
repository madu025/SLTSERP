import { prisma } from '@/lib/prisma';
import { Prisma, ServiceOrder } from '@prisma/client';
import { sltApiService, SLTServiceOrderData } from './slt-api.service';
import { NotificationService } from './notification.service';
import { TransactionClient } from './inventory/types';

interface MaterialUsageInput {
    itemId: string;
    quantity: string;
    usageType: string;
    unit?: string;
    wastagePercent?: string;
    exceedsLimit?: boolean;
    comment?: string;
    serialNumber?: string;
}

interface SltRejection {
    SO_NUM: string;
    LEA?: string;
    VOICENUMBER: string | null;
    S_TYPE: string;
    ORDER_TYPE: string;
    CON_WORO_TASK_NAME?: string;
    PKG?: string;
    CON_NAME?: string;
    PAT_USER: string | null;
    CON_STATUS_DATE: string;
    RTOM?: string;
}

export interface ServiceOrderUpdateData {
    sltsStatus?: string;
    status?: string;
    statusDate?: string | Date;
    receivedDate?: string | Date;
    completedDate?: string | Date;
    contractorId?: string | null;
    comments?: string;
    ontSerialNumber?: string;
    iptvSerialNumbers?: string | string[];
    dpDetails?: string;
    teamId?: string | null;
    directTeamName?: string;
    dropWireDistance?: string | number;
    sltsPatStatus?: string;
    opmcPatStatus?: string;
    hoPatStatus?: string;
    materialUsage?: MaterialUsageInput[];
    returnReason?: string;
    wiredOnly?: boolean;
}

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
        cursor?: string;
        month?: number;
        year?: number;
    }) {
        const { rtomId: opmcId, filter, search, statusFilter, patFilter, matFilter, page = 1, limit = 50, cursor, month, year } = params;

        // Offset-based fallback for backward compatibility
        const skip = cursor ? 1 : (page - 1) * limit;

        if (!opmcId) {
            throw new Error('RTOM_ID_REQUIRED');
        }

        // Build where clause
        const whereClause: Prisma.ServiceOrderWhereInput = { opmcId };

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
        const completionStatuses = ["COMPLETED", "INSTALL_CLOSED", "PAT_OPMC_PASSED", "PAT_CORRECTED"];

        if (filter === 'pending') {
            whereClause.sltsStatus = { notIn: ['COMPLETED', 'RETURN'] };
            whereClause.status = { notIn: completionStatuses };
        } else if (filter === 'completed') {
            whereClause.OR = [
                { sltsStatus: 'COMPLETED' },
                { status: { in: completionStatuses } }
            ];
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
            whereClause.status = { in: ["ASSIGNED", "INPROGRESS", "PROV_CLOSED"] };
        }

        if (patFilter && patFilter !== 'ALL') {
            if (patFilter === 'READY') {
                whereClause.isInvoicable = true;
            } else if (patFilter === 'OPMC_REJECTED') {
                whereClause.opmcPatStatus = 'REJECTED';
            } else if (patFilter === 'HO_REJECTED') {
                whereClause.hoPatStatus = 'REJECTED';
            } else if (patFilter === 'HO_PASS' || patFilter === 'PAT_PASSED') {
                whereClause.hoPatStatus = 'PAT_PASSED';
            } else if (patFilter === 'SLTS_PASS') {
                whereClause.sltsPatStatus = 'PAT_PASSED';
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
        let primaryOrderBy: Prisma.ServiceOrderOrderByWithRelationInput = { createdAt: 'desc' };
        if (filter === 'completed') {
            primaryOrderBy = { completedDate: 'desc' };
        } else if (filter === 'return') {
            primaryOrderBy = { updatedAt: 'desc' };
        }

        // Use array for stable sorting with ID fallback
        const orderBy: Prisma.ServiceOrderOrderByWithRelationInput[] = [primaryOrderBy, { id: 'desc' }];

        // Run queries in parallel
        const [total, items, statusGroups, contractorCount, appointmentCount, opmcGroups, hoGroups, sltGroups] = await Promise.all([
            prisma.serviceOrder.count({ where: whereClause }),
            prisma.serviceOrder.findMany({
                where: whereClause,
                select: {
                    id: true,
                    soNum: true,
                    voiceNumber: true,
                    orderType: true,
                    serviceType: true,
                    customerName: true,
                    status: true,
                    statusDate: true,
                    sltsStatus: true,
                    completedDate: true,
                    contractorId: true,
                    contractor: { select: { name: true } },
                    // ⚠️ Removed large fields like address, dp, etc. which are not in the main table
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
                take: limit,
                cursor: cursor ? { id: cursor } : undefined,
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
            }),
            // PAT Breakdowns (Group 5, 6, 7)
            prisma.serviceOrder.groupBy({ by: ['opmcPatStatus'], where: whereClause, _count: true }),
            prisma.serviceOrder.groupBy({ by: ['hoPatStatus'], where: whereClause, _count: true }),
            prisma.serviceOrder.groupBy({ by: ['sltsPatStatus'], where: whereClause, _count: true })
        ]);

        return {
            items,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
                nextCursor: items.length === limit ? items[items.length - 1].id : undefined
            },
            summary: {
                totalSod: total,
                contractorAssigned: contractorCount,
                appointments: appointmentCount,
                statusBreakdown: statusGroups.reduce((acc, curr) => {
                    acc[curr.status] = curr._count;
                    return acc;
                }, {} as Record<string, number>),
                patBreakdown: {
                    opmc: (opmcGroups || []).reduce((acc: Record<string, number>, curr: Prisma.PickEnumerable<Prisma.ServiceOrderGroupByOutputType, "opmcPatStatus"[]> & { _count: number }) => { acc[curr.opmcPatStatus || 'PENDING'] = curr._count; return acc; }, {} as Record<string, number>),
                    ho: (hoGroups || []).reduce((acc: Record<string, number>, curr: Prisma.PickEnumerable<Prisma.ServiceOrderGroupByOutputType, "hoPatStatus"[]> & { _count: number }) => { acc[curr.hoPatStatus || 'PENDING'] = curr._count; return acc; }, {} as Record<string, number>),
                    slt: (sltGroups || []).reduce((acc: Record<string, number>, curr: Prisma.PickEnumerable<Prisma.ServiceOrderGroupByOutputType, "sltsPatStatus"[]> & { _count: number }) => { acc[curr.sltsPatStatus || 'PENDING'] = curr._count; return acc; }, {} as Record<string, number>),
                }
            }
        };
    }

    // Create a manual service order
    static async createServiceOrder(data: any) {
        let soNum = data.soNum;
        if (!soNum) {
            const now = new Date();
            const dateStr = now.getFullYear().toString() +
                (now.getMonth() + 1).toString().padStart(2, '0') +
                now.getDate().toString().padStart(2, '0');
            const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
            soNum = `MANUAL-${dateStr}-${random}`;
        }

        const opmc = await prisma.oPMC.findFirst({
            where: { id: data.rtomId }
        });

        if (!opmc) throw new Error('INVALID_OPMC');

        const serviceOrder = await prisma.serviceOrder.create({
            data: {
                soNum,
                rtom: opmc.rtom,
                opmcId: opmc.id,
                lea: data.lea || '',
                voiceNumber: data.voiceNumber,
                orderType: data.orderType || 'MANUAL',
                serviceType: data.serviceType || 'FTTH',
                customerName: data.customerName,
                techContact: data.techContact,
                status: data.status || 'INPROGRESS',
                sltsStatus: data.status || 'INPROGRESS',
                address: data.address,
                dp: data.dp,
                package: data.package,
                sales: data.sales,
                isManualEntry: true,
                receivedDate: new Date(),
                statusDate: new Date()
            }
        });

        // Initialize status history
        await prisma.serviceOrderStatusHistory.create({
            data: {
                serviceOrderId: serviceOrder.id,
                status: serviceOrder.status,
                statusDate: new Date()
            }
        }).catch(() => { });

        return serviceOrder;
    }

    // Bulk import from Excel
    static async bulkImportServiceOrders(data: any[]) {
        let created = 0;
        let failed = 0;

        // Pre-fetch all OPMCs to map rtom to id
        const opmcs = await prisma.oPMC.findMany();
        const opmcMap = new Map(opmcs.map(o => [o.rtom.toUpperCase().trim(), o.id]));

        for (const item of data) {
            try {
                const soNum = item.soNum || item.SOD;
                if (!soNum) {
                    failed++;
                    continue;
                }

                const rtomKey = (item.rtom || item.RTOM)?.toUpperCase()?.trim();
                const opmcId = opmcMap.get(rtomKey);

                if (!opmcId) {
                    console.error(`Opmc not found for RTOM: ${rtomKey}`);
                    failed++;
                    continue;
                }

                // Map Excel fields to DB fields
                const dbData = {
                    rtom: item.rtom || item.RTOM,
                    lea: item.lea || item.LEA,
                    soNum: soNum,
                    voiceNumber: item.voiceNumber || item.CIRCUIT,
                    serviceType: item.serviceType || item.SERVICE,
                    orderType: item.orderType || item['ORDER TYPE'],
                    woroTaskName: item.woroTaskName || item.TASK,
                    package: item.package || item.PACKAGE,
                    status: item.status || item.STATUS,
                    customerName: item.customerName || item.CON_CUS_NAME,
                    techContact: item.techContact || item.CON_TEC_CONTACT,
                    address: item.address || item.ADDRESS,
                    dp: item.dp || item.DP,
                    ospPhoneClass: item.ospPhoneClass || item.PHONE_CLASS,
                    phonePurchase: item.phonePurchase || item.PHONE_PURCH,
                    sales: item.sales || item['SALES PERSON'],
                    iptv: String(item.iptv || item['IPTV COUNT'] || '0'),
                    isManualEntry: true,
                    opmcId
                };

                const receivedOnStr = item.receivedDate || item['RECEIVED ON'];
                let receivedDate = new Date();
                if (receivedOnStr) {
                    const parsed = new Date(receivedOnStr);
                    if (!isNaN(parsed.getTime())) {
                        receivedDate = parsed;
                    }
                }

                await prisma.serviceOrder.upsert({
                    where: { soNum },
                    update: {
                        ...dbData,
                        statusDate: receivedDate,
                        receivedDate: receivedDate
                    },
                    create: {
                        ...dbData,
                        statusDate: receivedDate,
                        receivedDate: receivedDate,
                        sltsStatus: dbData.status === 'INSTALL_CLOSED' ? 'COMPLETED' : 'INPROGRESS'
                    }
                });
                created++;
            } catch (err) {
                console.error(`Bulk import failed for item:`, item, err);
                failed++;
            }
        }

        return { created, failed };
    }

    /**
     * Patch Update (Status Change, Completion, etc.)
     */
    static async patchServiceOrder(id: string, data: ServiceOrderUpdateData, userId?: string): Promise<ServiceOrder> {
        if (!id) throw new Error('ID_REQUIRED');

        const oldOrder = await prisma.serviceOrder.findUnique({
            where: { id },
            include: { materialUsage: true }
        });
        if (!oldOrder) throw new Error('ORDER_NOT_FOUND');

        const { sltsStatus, status, statusDate, receivedDate, completedDate, contractorId, comments, ...otherData } = data;
        const updateData: Prisma.ServiceOrderUncheckedUpdateInput = {};

        // 1. UNIQUE CONSTRAINT PROTECTION (soNum, status)
        // If we are changing the status, we must ensure another record with same SO and NEW status doesn't exist
        if (status && status !== oldOrder.status) {
            const collision = await prisma.serviceOrder.findFirst({
                where: { soNum: oldOrder.soNum, status: status },
                select: { id: true }
            });
            if (collision && collision.id !== id) {
                console.warn(`[PATCH] Status collision detected for ${oldOrder.soNum} (${status}). Redirecting update to existing record.`);
                // Instead of updating THIS record to NEW status (which fails), 
                // we should update the ALREADY EXISTING record of that status.
                return this.patchServiceOrder(collision.id, { ...data, status: undefined }, userId);
            }
        }

        if (sltsStatus) {
            if (!['INPROGRESS', 'COMPLETED', 'RETURN', 'PROV_CLOSED'].includes(sltsStatus)) throw new Error('INVALID_STATUS');
            updateData.sltsStatus = sltsStatus;
            if ((sltsStatus === 'COMPLETED' || sltsStatus === 'RETURN') && !completedDate) throw new Error('COMPLETED_DATE_REQUIRED');
        }

        if (completedDate) updateData.completedDate = new Date(completedDate);
        if (contractorId !== undefined) updateData.contractorId = contractorId;
        if (comments !== undefined) updateData.comments = comments;
        if (otherData.wiredOnly !== undefined) updateData.wiredOnly = otherData.wiredOnly;

        // SLT Status fields mapping
        if (status) updateData.status = status;
        if (statusDate) updateData.statusDate = new Date(statusDate);
        if (receivedDate) updateData.receivedDate = new Date(receivedDate);

        // Completion fields mapping
        if (otherData.ontSerialNumber) updateData.ontSerialNumber = otherData.ontSerialNumber;
        if (otherData.iptvSerialNumbers) updateData.iptvSerialNumbers = Array.isArray(otherData.iptvSerialNumbers) ? JSON.stringify(otherData.iptvSerialNumbers) : otherData.iptvSerialNumbers;
        if (otherData.dpDetails) updateData.dpDetails = otherData.dpDetails;
        if (otherData.teamId) updateData.teamId = otherData.teamId || null;
        if (otherData.directTeamName) updateData.directTeam = otherData.directTeamName;

        let newDistance: number | undefined;
        if (otherData.dropWireDistance !== undefined) {
            newDistance = parseFloat(String(otherData.dropWireDistance || '0'));
            updateData.dropWireDistance = newDistance;
        }

        // Capture Snapshots at Completion
        if (updateData.sltsStatus === 'COMPLETED' || (oldOrder.sltsStatus !== 'COMPLETED' && sltsStatus === 'COMPLETED')) {
            const rtomId = oldOrder.opmcId;
            const distance = newDistance ?? oldOrder.dropWireDistance ?? 0;

            // 1. Calculate Revenue (Flat Rate per RTOM)
            const revConfig = await prisma.sODRevenueConfig.findFirst({
                where: { OR: [{ rtomId }, { rtomId: null }], isActive: true },
                orderBy: { rtomId: { sort: 'asc', nulls: 'last' } } // Specific RTOM first
            });
            if (revConfig) updateData.revenueAmount = revConfig.revenuePerSOD;

            // 2. Calculate Contractor Payment (Tiered Distance)
            const payConfig = await prisma.contractorPaymentConfig.findFirst({
                where: { OR: [{ rtomId }, { rtomId: null }], isActive: true },
                include: { tiers: true },
                orderBy: { rtomId: { sort: 'asc', nulls: 'last' } }
            });

            if (payConfig && payConfig.tiers && payConfig.tiers.length > 0) {
                const matchingTier = payConfig.tiers.find((t) =>
                    distance >= t.minDistance && distance <= t.maxDistance
                );
                if (matchingTier) {
                    updateData.contractorAmount = matchingTier.amount;
                } else {
                    // Fallback to highest tier if over distance mentioned
                    const sortedTiers = [...payConfig.tiers].sort((a, b) => b.maxDistance - a.maxDistance);
                    if (distance > sortedTiers[0].maxDistance) {
                        updateData.contractorAmount = sortedTiers[0].amount;
                    }
                }
            }
        }

        // PAT Updates from UI
        if (otherData.sltsPatStatus) {
            updateData.sltsPatStatus = otherData.sltsPatStatus;
            if (otherData.sltsPatStatus === 'PAT_PASSED' && oldOrder.sltsPatStatus !== 'PAT_PASSED') {
                updateData.sltsPatDate = new Date();
            }
        }
        if (otherData.opmcPatStatus) {
            updateData.opmcPatStatus = otherData.opmcPatStatus;
            if (otherData.opmcPatStatus === 'PAT_PASSED' && oldOrder.opmcPatStatus !== 'PAT_PASSED') {
                updateData.opmcPatDate = new Date();
            }
        }
        if (otherData.hoPatStatus) {
            updateData.hoPatStatus = otherData.hoPatStatus;
            if (otherData.hoPatStatus === 'PAT_PASSED' && oldOrder.hoPatStatus !== 'PAT_PASSED') {
                updateData.hoPatDate = new Date();
            }
        }

        // IMPORTANT: Invoicable logic - A connection becomes eligible for Invoice (Part A)
        // as soon as SLTS PAT is passed by the QC Officer.
        const finalizedSlts = updateData.sltsPatStatus || oldOrder.sltsPatStatus;
        updateData.isInvoicable = (finalizedSlts === 'PAT_PASSED');

        // Material Source Snapshot
        const configs: { value: string }[] = await prisma.$queryRaw`SELECT value FROM "SystemConfig" WHERE key = 'OSP_MATERIAL_SOURCE' LIMIT 1`;
        const currentSource = configs[0]?.value || 'SLT';

        const { InventoryService } = await import('./inventory.service');

        // Material Usage deduction & save
        if (otherData.materialUsage && Array.isArray(otherData.materialUsage)) {
            // Fetch material metadata to snapshot prices
            const itemIds = otherData.materialUsage.map((m: MaterialUsageInput) => m.itemId);
            const itemMetadata = await prisma.inventoryItem.findMany({
                where: { id: { in: itemIds } },
                select: { id: true, unitPrice: true, costPrice: true }
            });

            await prisma.$transaction(async (tx: TransactionClient) => {
                const targetContractorId = (contractorId || (updateData.contractorId as string | null) || oldOrder.contractorId) as string | null;
                const finalUsageRecords = [];

                if (targetContractorId) {
                    for (const m of otherData.materialUsage!) {
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
                            const meta = itemMetadata.find(i => i.id === m.itemId);
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
                    // No contractor (direct team) - Deduct from Store Stock
                    // Get store for this OPMC
                    const opmc = await tx.oPMC.findUnique({
                        where: { id: oldOrder.opmcId },
                        select: { storeId: true }
                    });

                    if (opmc?.storeId) {
                        for (const m of otherData.materialUsage!) {
                            const qty = parseFloat(m.quantity);
                            if (['USED', 'WASTAGE', 'USED_F1', 'USED_G1'].includes(m.usageType)) {
                                // A. Pick batches FIFO from Store
                                const pickedBatches = await InventoryService.pickStoreBatchesFIFO(tx, opmc.storeId, m.itemId, qty);

                                for (const picked of pickedBatches) {
                                    // B. Reduce from Store Batch Stock
                                    await tx.inventoryBatchStock.update({
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
                                const meta = itemMetadata.find(i => i.id === m.itemId);
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

        // Track status history if status changed
        if (status && status !== oldOrder.status) {
            await prisma.serviceOrderStatusHistory.create({
                data: {
                    serviceOrderId: id,
                    status: status,
                    statusDate: updateData.statusDate ? new Date(updateData.statusDate as string | Date) : (oldOrder.statusDate || new Date())
                }
            });
        }

        // Incremental Stats Update
        if (serviceOrder.sltsStatus !== oldOrder.sltsStatus) {
            try {
                const { StatsService } = await import('../lib/stats.service');
                await StatsService.handleStatusChange(serviceOrder.opmcId, oldOrder.sltsStatus, serviceOrder.sltsStatus);

                // Send Notifications based on new status
                if (serviceOrder.sltsStatus === 'RETURN') {
                    await NotificationService.notifyByRole({
                        roles: ['SUPER_ADMIN', 'ADMIN', 'OSP_MANAGER', 'AREA_MANAGER', 'ENGINEER'],
                        title: 'SOD Returned/Rejected',
                        message: `Service Order ${serviceOrder.soNum} has been marked as RETURN. Reason: ${serviceOrder.returnReason || 'No reason provided'}.`,
                        type: 'PROJECT',
                        priority: 'HIGH',
                        link: '/service-orders/return',
                        opmcId: serviceOrder.opmcId,
                        metadata: { soNum: serviceOrder.soNum, id: serviceOrder.id }
                    });
                }
            } catch (e) {
                console.error('Failed to update stats or send notifications:', e);
            }
        }

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
    static async syncPatResults(opmcId: string, rtom: string, hoRejected: SltRejection[] = []) {
        if (!opmcId || !rtom) throw new Error('RTOM_AND_ID_REQUIRED');

        console.log(`[PAT-SYNC] Syncing Rejections for ${rtom}...`);

        // 1. Fetch OPMC Rejected (opmcpatrej) - RTOM specific
        const opmcRejected = await sltApiService.fetchOpmcRejected(rtom);
        const rtHoRejected = hoRejected.filter((p) => p.RTOM === rtom);

        // 2. Prepare for strict mirroring:
        // Any SO currently in our 'REJECTED' cache for this RTOM that is NOT in the new API lists 
        // means it has been corrected/fixed. We MUST remove these from the cache.
        const incomingOpmcSoNums = opmcRejected.map(r => r.SO_NUM);
        const incomingHoSoNums = rtHoRejected.map(r => r.SO_NUM);

        await prisma.sLTPATStatus.deleteMany({
            where: {
                rtom,
                status: 'REJECTED',
                OR: [
                    { source: 'OPMC_REJECTED', soNum: { notIn: incomingOpmcSoNums } },
                    { source: 'HO_REJECTED', soNum: { notIn: incomingHoSoNums } }
                ]
            }
        });

        // 3. Cache the current rejections in SLTPATStatus table
        // We Upsert them to ensure we have the latest rejected status
        for (const rej of opmcRejected) {
            await prisma.sLTPATStatus.upsert({
                where: { soNum: rej.SO_NUM },
                update: {
                    status: 'REJECTED',
                    source: 'OPMC_REJECTED',
                    lea: rej.LEA,
                    voiceNumber: rej.VOICENUMBER,
                    sType: rej.S_TYPE,
                    orderType: rej.ORDER_TYPE,
                    task: rej.CON_WORO_TASK_NAME,
                    package: rej.PKG,
                    conName: rej.CON_NAME,
                    patUser: rej.PAT_USER,
                    statusDate: sltApiService.parseStatusDate(rej.CON_STATUS_DATE),
                    updatedAt: new Date()
                },
                create: {
                    soNum: rej.SO_NUM,
                    status: 'REJECTED',
                    source: 'OPMC_REJECTED',
                    rtom,
                    lea: rej.LEA,
                    voiceNumber: rej.VOICENUMBER,
                    sType: rej.S_TYPE,
                    orderType: rej.ORDER_TYPE,
                    task: rej.CON_WORO_TASK_NAME,
                    package: rej.PKG,
                    conName: rej.CON_NAME,
                    patUser: rej.PAT_USER,
                    statusDate: sltApiService.parseStatusDate(rej.CON_STATUS_DATE)
                }
            });
        }

        for (const rej of rtHoRejected) {
            await prisma.sLTPATStatus.upsert({
                where: { soNum: rej.SO_NUM },
                update: {
                    status: 'REJECTED',
                    source: 'HO_REJECTED',
                    lea: rej.LEA,
                    voiceNumber: rej.VOICENUMBER,
                    sType: rej.S_TYPE,
                    orderType: rej.ORDER_TYPE,
                    task: rej.CON_WORO_TASK_NAME,
                    package: rej.PKG,
                    conName: rej.CON_NAME,
                    patUser: rej.PAT_USER,
                    statusDate: sltApiService.parseStatusDate(rej.CON_STATUS_DATE),
                    updatedAt: new Date()
                },
                create: {
                    soNum: rej.SO_NUM,
                    status: 'REJECTED',
                    source: 'HO_REJECTED',
                    rtom,
                    lea: rej.LEA,
                    voiceNumber: rej.VOICENUMBER,
                    sType: rej.S_TYPE,
                    orderType: rej.ORDER_TYPE,
                    task: rej.CON_WORO_TASK_NAME,
                    package: rej.PKG,
                    conName: rej.CON_NAME,
                    patUser: rej.PAT_USER,
                    statusDate: sltApiService.parseStatusDate(rej.CON_STATUS_DATE)
                }
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

            const updateObj: Prisma.ServiceOrderUpdateInput = {};
            if (!isOpmcRej && order.opmcPatStatus === 'REJECTED') updateObj.opmcPatStatus = 'PENDING';
            if (!isHoRej && order.hoPatStatus === 'REJECTED') updateObj.hoPatStatus = 'PENDING';

            if (Object.keys(updateObj).length > 0) {
                await prisma.serviceOrder.update({ where: { id: order.id }, data: updateObj });
                updated++;
            }
        }

        // 4. Update ServiceOrder table from cached SLTPATStatus for this RTOM
        const cachedRejections = await prisma.sLTPATStatus.findMany({
            where: { rtom, status: 'REJECTED' }
        });

        for (const rej of cachedRejections) {
            const order = await prisma.serviceOrder.findFirst({
                where: { soNum: rej.soNum, opmcId, sltsStatus: 'COMPLETED' }
            });
            if (order) {
                const update: Prisma.ServiceOrderUpdateInput = {};
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

        if (updated > 0) {
            const { StatsService } = await import('../lib/stats.service');
            await StatsService.syncOpmcStats(opmcId);
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
            } catch (err) {
                console.error(`PAT/Rejection Sync failed for ${opmc.rtom}:`, err);
            }
        }

        return { totalUpdated, hoApproved: { totalCached: 0, totalUpdated: 0 } };
    }


    /**
     * Optimized HO Approved Sync with DB Caching
     * Reverted to per-RTOM loop because Global 'patsuccess' link returns 500 error in SLT API
     */
    /**
     * Robust HO Approved Sync
     * Tries Global URL first, falls back to Regional Sync if Global fails (500 Error)
     */
    static async syncHoApprovedResults() {
        console.log('[PAT-SYNC] Starting HO Approved sync...');

        try {
            // 1. Try Global Fetch first (Efficiency)
            let apiData = await sltApiService.fetchHOApprovedGlobal();

            if (!apiData || apiData.length === 0) {
                console.log('[PAT-SYNC] Global fetch failed or returned empty. Falling back to Date-wise Sync (Last 30 days)...');

                // 2. FALLBACK: Date Loop (Fetch day-by-day to avoid 500 errors)
                apiData = [];
                const now = new Date();
                for (let d = 0; d < 30; d++) {
                    const date = new Date(now);
                    date.setDate(now.getDate() - d);
                    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD

                    try {
                        console.log(`[PAT-SYNC] Fetching PAT results for date: ${dateStr}...`);
                        const dayData = await sltApiService.fetchPATResultsByDate(dateStr);
                        if (dayData && dayData.length > 0) {
                            apiData.push(...dayData);
                            console.log(`[PAT-SYNC] Received ${dayData.length} records for ${dateStr}`);
                        }
                    } catch (e) {
                        console.error(`[PAT-SYNC] Failed to fetch for date ${dateStr}:`, e);
                    }
                }
            }

            if (!apiData || apiData.length === 0) {
                console.log('[PAT-SYNC] No data received from any source (Global or Date-wise).');
                return { totalCached: 0, totalUpdated: 0 };
            }

            console.log(`[PAT-SYNC] Total raw records received: ${apiData.length}`);

            // 3. Date Filtering (Don't re-process old stuff unless within buffer)
            const latestStatus = await prisma.sLTPATStatus.findFirst({
                where: { source: 'HO_APPROVED' },
                orderBy: { statusDate: 'desc' },
                select: { statusDate: true }
            });
            const filterDate = latestStatus?.statusDate
                ? new Date(latestStatus.statusDate.getTime() - (2 * 24 * 60 * 60 * 1000))
                : new Date(0);

            const filteredData = apiData.filter(item => {
                const sDate = sltApiService.parseStatusDate(item.CON_STATUS_DATE);
                return sDate && sDate >= filterDate;
            });

            console.log(`[PAT-SYNC] After date filtering, processing ${filteredData.length} relevant records.`);
            if (filteredData.length === 0) return { totalCached: 0, totalUpdated: 0 };

            // 4. Batch Processing (1,000 at a time)
            const batchSize = 1000;
            let totalCached = 0;
            let totalUpdated = 0;

            for (let i = 0; i < filteredData.length; i += batchSize) {
                const batch = filteredData.slice(i, i + batchSize);
                const cacheData = batch.map(app => ({
                    soNum: app.SO_NUM,
                    status: 'PAT_PASSED',
                    source: 'HO_APPROVED',
                    rtom: app.RTOM,
                    lea: app.LEA || '',
                    voiceNumber: app.VOICENUMBER,
                    sType: app.S_TYPE,
                    orderType: app.ORDER_TYPE,
                    task: app.CON_WORO_TASK_NAME || '',
                    package: app.PKG || '',
                    conName: app.CON_NAME || '',
                    patUser: app.PAT_USER,
                    statusDate: sltApiService.parseStatusDate(app.CON_STATUS_DATE) as Date
                }));

                const soNums = batch.map(b => b.SO_NUM);

                // Update Cache (Strict Mirroring)
                // To ensure we don't have stale 'REJECTED' status for an order that is now 'APPROVED',
                // we clear existing cache entries for these SO numbers before inserting the latest data.
                await prisma.sLTPATStatus.deleteMany({
                    where: { soNum: { in: soNums } }
                });

                const result = await prisma.sLTPATStatus.createMany({
                    data: cacheData
                });
                totalCached += result.count;

                // Update Matching ServiceOrders
                const ordersToUpdate = await prisma.serviceOrder.findMany({
                    where: {
                        soNum: { in: soNums },
                        sltsStatus: 'COMPLETED',
                        hoPatStatus: { not: 'PAT_PASSED' }
                    },
                    select: { id: true, soNum: true, sltsPatStatus: true }
                });

                for (const order of ordersToUpdate) {
                    const match = batch.find(b => b.SO_NUM === order.soNum);
                    if (match) {
                        await prisma.serviceOrder.update({
                            where: { id: order.id },
                            data: {
                                hoPatStatus: 'PAT_PASSED',
                                hoPatDate: sltApiService.parseStatusDate(match.CON_STATUS_DATE),
                                opmcPatStatus: 'PAT_PASSED',
                                isInvoicable: order.sltsPatStatus === 'PAT_PASSED'
                            }
                        });
                        totalUpdated++;
                    }
                }

                console.log(`[PAT-SYNC] Batch Progress: ${Math.min(i + batchSize, filteredData.length)} / ${filteredData.length} ...`);
            }

            console.log(`[PAT-SYNC] HO Approved Sync complete. Cached: ${totalCached}, Updated: ${totalUpdated}`);

            // Sync all OPMCs affected by this bulk update
            const opmcs = await prisma.oPMC.findMany({ select: { id: true, rtom: true } });
            const { StatsService } = await import('../lib/stats.service');
            for (const opmc of opmcs) {
                await StatsService.syncOpmcStats(opmc.id);
            }

            return { totalCached, totalUpdated };

        } catch (err) {
            console.error('[PAT-SYNC] HO Approved Sync Failed:', err);
            return { totalCached: 0, totalUpdated: 0, error: String(err) };
        }
    }

    static async syncAllOpmcs() {
        const opmcs = await prisma.oPMC.findMany({ select: { id: true, rtom: true } });
        const results: Record<string, unknown>[] = [];
        let created = 0;
        let updated = 0;
        let failed = 0;

        for (const opmc of opmcs) {
            try {
                const res = await this.syncServiceOrders(opmc.id, opmc.rtom);
                results.push({ rtom: opmc.rtom, ...res });
                created += res.created || 0;
                updated += res.updated || 0;
            } catch (err) {
                results.push({ rtom: opmc.rtom, error: err instanceof Error ? err.message : String(err) });
                failed++;
            }
        }
        const finalStats = {
            created,
            updated,
            failed,
            lastSync: new Date().toISOString()
        };

        // Update System Setting for Frontend
        try {
            await prisma.systemSetting.upsert({
                where: { key: 'LAST_SYNC_STATS' },
                update: { value: finalStats },
                create: { key: 'LAST_SYNC_STATS', value: finalStats }
            });
        } catch (e) {
            console.error('Failed to update sync stats in DB:', e);
        }

        return { stats: finalStats, details: results };
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

        // Deduplicate syncable data by soNum and status to prevent parallel upsert collisions
        const uniqueSyncMap = new Map<string, SLTServiceOrderData>();
        sltData.forEach(item => {
            if (!lockedSoNums.has(item.SO_NUM)) {
                uniqueSyncMap.set(`${item.SO_NUM}_${item.CON_STATUS}`, item);
            }
        });
        const syncableData = Array.from(uniqueSyncMap.values());

        let created = 0; let updated = 0;
        for (const item of syncableData) {
            try {
                const statusDate = sltApiService.parseStatusDate(item.CON_STATUS_DATE) || new Date();

                // Determine sltsStatus based on SLT status - Strictly 'INSTALL_CLOSED' as per user requirement
                const completionStatuses = ['INSTALL_CLOSED'];
                const initialSltsStatus = completionStatuses.includes(item.CON_STATUS) ? 'COMPLETED' : 'INPROGRESS';

                // Check if this specific soNum exists
                // Check if this soNum already exists in our system
                const existing = await prisma.serviceOrder.findFirst({
                    where: { soNum: item.SO_NUM }
                });

                let result;
                const updatePayload: Prisma.ServiceOrderUncheckedUpdateInput = {
                    status: item.CON_STATUS,
                    lea: item.LEA,
                    voiceNumber: item.VOICENUMBER,
                    orderType: item.ORDER_TYPE,
                    serviceType: item.S_TYPE,
                    customerName: item.CON_CUS_NAME,
                    techContact: item.CON_TEC_CONTACT,
                    statusDate,
                    address: item.ADDRE,
                    dp: item.DP,
                    package: item.PKG,
                    woroTaskName: item.CON_WORO_TASK_NAME,
                    iptv: item.IPTV,
                    woroSeit: item.CON_WORO_SEIT,
                    ftthInstSeit: item.FTTH_INST_SIET,
                    ftthWifi: item.FTTH_WIFI,
                    ospPhoneClass: item.CON_OSP_PHONE_CLASS,
                    phonePurchase: item.CON_PHN_PURCH,
                    sales: item.CON_SALES
                };

                if (existing) {
                    result = await prisma.serviceOrder.update({
                        where: { id: existing.id },
                        data: updatePayload,
                        select: { id: true, createdAt: true, updatedAt: true }
                    });
                } else {
                    // SMART FILTER: 
                    // 1. Always import active work (INPROGRESS) regardless of date.
                    // 2. ONLY import finished work (COMPLETED) if it happened in 2026 or later.
                    const isFinished = initialSltsStatus === 'COMPLETED';
                    const isRecent = statusDate.getFullYear() >= 2026;
                    const shouldImport = !isFinished || isRecent;

                    if (shouldImport) {
                        result = await prisma.serviceOrder.create({
                            data: {
                                status: item.CON_STATUS,
                                lea: item.LEA,
                                voiceNumber: item.VOICENUMBER,
                                orderType: item.ORDER_TYPE,
                                serviceType: item.S_TYPE,
                                customerName: item.CON_CUS_NAME,
                                techContact: item.CON_TEC_CONTACT,
                                statusDate,
                                address: item.ADDRE,
                                dp: item.DP,
                                package: item.PKG,
                                woroTaskName: item.CON_WORO_TASK_NAME,
                                iptv: item.IPTV,
                                woroSeit: item.CON_WORO_SEIT,
                                ftthInstSeit: item.FTTH_INST_SIET,
                                ftthWifi: item.FTTH_WIFI,
                                ospPhoneClass: item.CON_OSP_PHONE_CLASS,
                                phonePurchase: item.CON_PHN_PURCH,
                                sales: item.CON_SALES,
                                opmcId,
                                rtom: item.RTOM || rtom,
                                soNum: item.SO_NUM,
                                receivedDate: statusDate,
                                sltsStatus: initialSltsStatus
                            },
                            select: { id: true, createdAt: true, updatedAt: true }
                        });
                    } else {
                        // Skip old, non-completed historical junk data
                        continue;
                    }
                }

                // Record history if new
                if (!existing) {
                    await prisma.serviceOrderStatusHistory.create({
                        data: {
                            serviceOrderId: result.id,
                            status: item.CON_STATUS,
                            statusDate: statusDate
                        }
                    }).catch(() => { });
                }

                if (result.createdAt.getTime() === result.updatedAt.getTime()) created++;
                else updated++;
            } catch (err) {
                console.error(`[SYNC] Failed to sync ${item.SO_NUM}:`, err);
            }
        }

        // Sync Stats
        if (created > 0 || updated > 0) {
            const { StatsService } = await import('../lib/stats.service');
            await StatsService.syncOpmcStats(opmcId);
        }

        return { created, updated };
    }
}
