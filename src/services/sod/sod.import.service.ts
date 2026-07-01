import { prisma } from '@/lib/prisma';
import { addJob, statsUpdateQueue } from '../../lib/queue';

export class SODImportService {
    /**
     * Bulk Import from Excel data
     */
    static async bulkImportServiceOrders(rtom: string, data: Record<string, unknown>[], opmcId: string) {
        let created = 0;
        let failed = 0;
        const errors: string[] = [];

        console.log(`[BULK-IMPORT] Processing ${data.length} records for RTOM: ${rtom}`);

        for (const item of data) {
            try {
                const soNum = String(item['SO Number'] || item['SO_NUM'] || item['SOD'] || '').trim();
                if (!soNum) continue;

                const existing = await prisma.serviceOrder.findUnique({
                    where: { soNum },
                    select: { id: true, sltsStatus: true }
                });

                const excelStatus = String(item['Status'] || item['CON_STATUS'] || '');
                const completionStatuses = ['INSTALL_CLOSED', 'COMPLETED', 'FINISHED'];
                const returnStatuses = ['RETURN', 'RETURNED', 'REJECTED', 'CANCELLED', 'CANCEL', 'COMPLETED-RETURN'];
                const excelStatusUpper = excelStatus.toUpperCase();
                const isCompleted = completionStatuses.includes(excelStatusUpper);
                const isReturned = returnStatuses.includes(excelStatusUpper);
                const sltsStatusVal = isCompleted ? 'COMPLETED' : (isReturned ? 'RETURN' : 'INPROGRESS');

                const voiceNumber = String(item['Voice Number'] || item['VOICENUMBER'] || item['CIRCUIT'] || '');
                const orderType = String(item['Order Type'] || item['ORDER_TYPE'] || item['TASK_TYPE'] || '');
                const serviceType = String(item['Service Type'] || item['S_TYPE'] || item['SERVICE'] || '');
                const customerName = String(item['Customer Name'] || item['CON_CUS_NAME'] || item['CUS_NAME'] || '');
                const address = String(item['Address'] || item['ADDRE'] || item['CUS_ADDR'] || '');
                const dp = String(item['DP'] || item['DP_NAME'] || '');
                const pkg = String(item['Package'] || item['PKG'] || item['S_PKG'] || '');
                const lea = String(item['LEA'] || item['LEA_NAME'] || '');
                const woroTaskName = String(item['WORO Task Name'] || item['TASK'] || '');
                const techContact = String(item['Tech Contact'] || item['TECH_NO'] || '');
                const sales = String(item['Sales'] || item['SALES_PERSON'] || '');

                const createData = {
                    soNum,
                    rtom: rtom,
                    opmcId: opmcId,
                    status: excelStatus,
                    sltsStatus: sltsStatusVal,
                    voiceNumber,
                    orderType,
                    serviceType,
                    customerName,
                    address,
                    dp,
                    package: pkg,
                    lea,
                    woroTaskName,
                    techContact,
                    sales,
                    receivedDate: new Date(),
                    completedDate: isCompleted ? new Date() : null,
                    returnReason: isReturned ? (excelStatus || 'Returned in Excel Import') : null
                };

                const updateData = {
                    status: excelStatus,
                    sltsStatus: sltsStatusVal,
                    completedDate: isCompleted ? new Date() : (isReturned ? null : undefined),
                    returnReason: isReturned ? (excelStatus || 'Returned in Excel Import') : (isCompleted ? null : undefined),
                    voiceNumber,
                    orderType,
                    serviceType,
                    customerName,
                    address,
                    dp,
                    package: pkg,
                    lea,
                    woroTaskName,
                    techContact,
                    sales,
                };

                if (existing) {
                    const isReturning = (sltsStatusVal === 'RETURN' && existing.sltsStatus !== 'RETURN');
                    await prisma.$transaction(async (tx) => {
                        await tx.serviceOrder.update({
                            where: { id: existing.id },
                            data: updateData
                        });
                        if (isReturning) {
                            const { SODMaterialService } = await import('./sod.material.service');
                            await SODMaterialService.rollbackMaterialUsage(tx, existing.id, 'EXCEL_IMPORT');
                            const { LedgerService } = await import('../finance/ledger.service');
                            await LedgerService.rollbackSodTransaction(tx, existing.id);
                        }
                    });
                } else {
                    await prisma.serviceOrder.create({
                        data: createData
                    });
                }
                created++;
            } catch (err) {
                failed++;
                errors.push(err instanceof Error ? err.message : String(err));
            }
        }

        if (created > 0) {
            await addJob(statsUpdateQueue, `stats-${opmcId}`, {
                opmcId,
                type: 'SINGLE_OPMC'
            }, { jobId: `stats-${opmcId}-${new Date().toISOString().split('T')[0]}` });
        }

        return { rtom, created, failed, errors: errors.slice(0, 5) };
    }

    /**
     * Import legacy service orders from excel rows (with full mapping and material usage snapshots)
     */
    static async bulkImportLegacyServiceOrders(
        rows: Array<{
            rtom: string;
            voiceNumber?: string;
            orderType?: string;
            receivedDate?: Date | string | null;
            completedDate?: Date | string | null;
            package?: string;
            dropWireDistance?: number;
            contractorName?: string;
            directTeamName?: string;
            materials?: Record<string, number>;
        }>,
        skipMaterials: boolean = false
    ) {
        // Get ALL OPMCs to map RTOM codes
        const allOpmcs = await prisma.oPMC.findMany({
            select: { id: true, rtom: true, storeId: true }
        });

        // Build RTOM -> OPMC map (handles both "AD" and "R-AD" formats)
        const opmcMap: Record<string, { id: string; rtom: string; storeId: string | null }> = {};
        for (const opmc of allOpmcs) {
            opmcMap[opmc.rtom.toUpperCase()] = opmc;
            const shortCode = opmc.rtom.replace('R-', '');
            opmcMap[shortCode.toUpperCase()] = opmc;
        }

        // Get all inventory items with their import aliases
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const inventoryItemsRaw = await (prisma.inventoryItem as any).findMany({
            select: { id: true, code: true, name: true, importAliases: true, unitPrice: true, costPrice: true }
        });
        const inventoryItems = inventoryItemsRaw as Array<{
            id: string;
            code: string | null;
            name: string;
            importAliases: string[];
            unitPrice: number | null;
            costPrice: number | null;
        }>;

        // Build alias -> itemId map
        const aliasMap: Record<string, string> = {};
        for (const item of inventoryItems) {
            if (item.importAliases && item.importAliases.length > 0) {
                for (const alias of item.importAliases) {
                    aliasMap[alias.toUpperCase().trim()] = item.id;
                }
            }
        }

        // Get ALL contractors for mapping
        const allContractors = await prisma.contractor.findMany({
            select: { id: true, name: true, opmcId: true }
        });

        // Build contractor name -> id map (grouped by OPMC)
        const contractorMap: Record<string, Record<string, string>> = {};
        for (const c of allContractors) {
            if (c.opmcId) {
                if (!contractorMap[c.opmcId]) {
                    contractorMap[c.opmcId] = {};
                }
                contractorMap[c.opmcId][c.name.toUpperCase().trim()] = c.id;
            }
        }

        // Fetch SLTPATStatus records to recover real SO_NUMs by Voice Number
        const patRecords = await prisma.sLTPATStatus.findMany({
            select: { soNum: true, voiceNumber: true }
        });

        const voiceToSoMap: Record<string, string> = {};
        for (const p of patRecords) {
            if (p.voiceNumber) {
                voiceToSoMap[p.voiceNumber.trim()] = p.soNum;
            }
        }

        const results: Array<{
            success: boolean;
            soNum: string;
            voiceNumber: string;
            rtom: string;
            soNumSource: 'PAT' | 'LEGACY';
            error?: string;
        }> = [];
        let successCount = 0;
        let errorCount = 0;
        let skippedNoOpmc = 0;

        const BATCH_SIZE = 100;

        for (let i = 0; i < rows.length; i += BATCH_SIZE) {
            const batch = rows.slice(i, i + BATCH_SIZE);

            for (const row of batch) {
                try {
                    const rtomKey = (row.rtom || '').toUpperCase().trim();
                    const opmc = opmcMap[rtomKey];

                    if (!opmc) {
                        results.push({
                            success: false,
                            soNum: '',
                            voiceNumber: row.voiceNumber || '',
                            rtom: row.rtom || '',
                            soNumSource: 'LEGACY',
                            error: `OPMC not found for RTOM: ${row.rtom}`
                        });
                        skippedNoOpmc++;
                        errorCount++;
                        continue;
                    }

                    const realVoiceNumber = (row.voiceNumber || '').trim();
                    let soNum = voiceToSoMap[realVoiceNumber];
                    let isAutoGenerated = false;

                    if (!soNum) {
                        const legacyDate = row.completedDate ? new Date(row.completedDate) : new Date();
                        const yearMonth = `${legacyDate.getFullYear()}${String(legacyDate.getMonth() + 1).padStart(2, '0')}`;
                        const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
                        soNum = `${opmc.rtom.replace('R-', '')}-LEG-${yearMonth}-${randomSuffix}`;
                        isAutoGenerated = true;
                    }

                    const opmcContractors = contractorMap[opmc.id] || {};
                    const contractorId = row.contractorName
                        ? opmcContractors[row.contractorName.toUpperCase().trim()] || null
                        : null;

                    let revenueAmount = 0;
                    let contractorAmount = 0;

                    const revConfig = await prisma.sODRevenueConfig.findFirst({
                        where: { OR: [{ rtomId: opmc.id }, { rtomId: null }], isActive: true },
                        orderBy: { rtomId: { sort: 'asc', nulls: 'last' } }
                    });
                    if (revConfig) revenueAmount = revConfig.revenuePerSOD ?? 0;

                    const payConfig = await prisma.contractorPaymentConfig.findFirst({
                        where: { OR: [{ rtomId: opmc.id }, { rtomId: null }], isActive: true },
                        include: { tiers: true },
                        orderBy: { rtomId: { sort: 'asc', nulls: 'last' } }
                    });
                    if (payConfig && payConfig.tiers && payConfig.tiers.length > 0) {
                        const dist = row.dropWireDistance || 0;
                        const matchingTier = payConfig.tiers.find(t => dist >= t.minDistance && dist <= t.maxDistance);
                        if (matchingTier) contractorAmount = matchingTier.amount;
                        else {
                            const sorted = [...payConfig.tiers].sort((a, b) => b.maxDistance - a.maxDistance);
                            if (dist > sorted[0].maxDistance) contractorAmount = sorted[0].amount;
                        }
                    }
                    const materialUsageData: Array<{
                        itemId: string;
                        quantity: number;
                        unit: string;
                        usageType: string;
                        unitPrice: number;
                        costPrice: number;
                    }> = [];

                    if (!skipMaterials && row.materials) {
                        for (const [idOrAlias, quantity] of Object.entries(row.materials)) {
                            const qtyVal = Number(quantity);
                            if (qtyVal && qtyVal > 0) {
                                const item = inventoryItems.find(i => i.id === idOrAlias || i.importAliases.includes(idOrAlias));
                                if (item) {
                                    materialUsageData.push({
                                        itemId: item.id,
                                        quantity: qtyVal,
                                        unit: 'Nos',
                                        usageType: 'USED',
                                        unitPrice: item.unitPrice || 0,
                                        costPrice: item.costPrice || 0
                                    });
                                }
                            }
                        }
                    }

                    const createData: Record<string, unknown> = {
                        soNum,
                        opmcId: opmc.id,
                        rtom: opmc.rtom,
                        voiceNumber: row.voiceNumber || null,
                        orderType: row.orderType || 'CREATE',
                        statusDate: row.receivedDate ? new Date(row.receivedDate) : null,
                        completedDate: row.completedDate ? new Date(row.completedDate) : null,
                        package: row.package || null,
                        dropWireDistance: row.dropWireDistance || 0,
                        revenueAmount,
                        contractorAmount,
                        status: 'COMPLETED',
                        sltsStatus: 'COMPLETED',
                        isLegacyImport: true,
                        directTeam: row.directTeamName || null,
                    };

                    if (contractorId) {
                        createData.contractorId = contractorId;
                    }

                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    await (prisma.serviceOrder as any).create({
                        data: {
                            ...createData,
                            ...(materialUsageData.length > 0 && {
                                materialUsage: { create: materialUsageData }
                            })
                        }
                    });

                    results.push({
                        success: true,
                        soNum,
                        voiceNumber: row.voiceNumber || '',
                        rtom: opmc.rtom,
                        soNumSource: isAutoGenerated ? 'LEGACY' : 'PAT'
                    });
                    successCount++;
                } catch (err) {
                    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
                    results.push({
                        success: false,
                        soNum: '',
                        voiceNumber: row.voiceNumber || '',
                        rtom: row.rtom || '',
                        soNumSource: 'LEGACY',
                        error: errorMsg
                    });
                    errorCount++;
                }
            }
        }

        return {
            successCount,
            errorCount,
            skippedNoOpmc,
            results
        };
    }
}
