import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import type { UUID } from '@/types/common';
import { addJob, statsUpdateQueue } from '../../lib/queue';
import { SODReturnClassifierService } from './sod-return-classifier.service';
import { ErrorUtil } from "../../utils/error.util";
import { safe } from '@/utils/safe-await.util';

export class SODImportService {
    /**
     * Bulk Import from Excel data
     */
    static async bulkImportServiceOrders(rtom: string, data: Record<string, unknown>[], opmcId: string) {
        let created = 0;
        let failed = 0;
        const errors: string[] = [];

        console.log(`[BULK-IMPORT] Processing ${data.length} records for RTOM: ${rtom}`);
        if (data.length === 0) return { rtom, created: 0, failed: 0, errors: [] };

        // 1. Pre-fetch existing SODs to avoid N+1 findUnique
        const soNums = data
            .map(item => String(item['SO Number'] || item['SO_NUM'] || item['SOD'] || '').trim())
            .filter(Boolean);
            
        const existingSods = await prisma.serviceOrder.findMany({
            where: { soNum: { in: soNums } },
            select: { id: true, soNum: true, sltsStatus: true, comments: true }
        });
        const existingMap = new Map<string, typeof existingSods[0]>();
        existingSods.forEach(sod => existingMap.set(sod.soNum, sod));

        // 2. Pre-fetch contractors to avoid N+1 resolveOrCreate
        const allContractors = await prisma.contractor.findMany({
            where: { opmcId },
            select: { id: true, name: true }
        });
        const contractorMap = new Map<string, string>();
        allContractors.forEach(c => contractorMap.set(c.name.toUpperCase().trim(), c.id));
        
        const { ContractorLifecycleService } = await import('../contractor/contractor.lifecycle.service');
        const { SODLifecycleService } = await import('./sod.lifecycle.service');

        const toCreate: Prisma.ServiceOrderCreateManyInput[] = [];
        const toUpdate: { existing: typeof existingSods[0], updateData: Prisma.ServiceOrderUncheckedUpdateInput }[] = [];

        for (const item of data) {
            const [err] = await safe((async () => {
                const soNum = String(item['SO Number'] || item['SO_NUM'] || item['SOD'] || '').trim();
                if (!soNum) return;

                const existing = existingMap.get(soNum);

                const excelStatus = String(item['Status'] || item['CON_STATUS'] || '').trim();
                const cleanStatus = excelStatus.toUpperCase() === 'ASSIGN' ? 'ASSIGNED' : excelStatus;
                
                // Use Central Mapper
                const sltsStatusVal = SODLifecycleService.mapExternalStatusToSltsStatus(cleanStatus);
                const isCompleted = sltsStatusVal === 'COMPLETED';
                const isReturned = sltsStatusVal === 'RETURN';

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
                const rawContractor = String(item['Contractor'] || item['CONTRACTOR'] || item['Contractor Name'] || item['CONTRACTOR_NAME'] || '').trim();
                
                let contractorId: string | undefined = undefined;
                if (rawContractor) {
                    const cKey = rawContractor.toUpperCase();
                    if (contractorMap.has(cKey)) {
                        contractorId = contractorMap.get(cKey);
                    } else {
                        contractorId = (await ContractorLifecycleService.resolveOrCreateContractorForOpmc(rawContractor, opmcId)) || undefined;
                        contractorMap.set(cKey, contractorId!);
                    }
                }

                if (existing) {
                    const updateData = {
                        status: cleanStatus as import("@prisma/client").ServiceOrderStatus,
                        sltsStatus: sltsStatusVal as import("@prisma/client").ServiceOrderStatus,
                        contractorId: contractorId,
                        completedDate: isCompleted ? new Date() : (isReturned ? null : undefined),
                        returnReason: isReturned ? SODReturnClassifierService.classify(cleanStatus || 'Returned in Excel Import').category : (isCompleted ? null : undefined),
                        comments: isReturned ? (existing?.comments ? `${existing.comments}\n[AI_CLASSIFIED] Reason: ${cleanStatus || 'Returned in Excel Import'}` : `[AI_CLASSIFIED] Reason: ${cleanStatus || 'Returned in Excel Import'}`) : undefined,
                        voiceNumber, orderType, serviceType, customerName, address, dp, package: pkg, lea, woroTaskName, techContact, sales,
                    };
                    toUpdate.push({ existing, updateData });
                } else {
                    toCreate.push({
                        soNum, rtom, opmcId, contractorId, status: cleanStatus as import("@prisma/client").ServiceOrderStatus, sltsStatus: sltsStatusVal as import("@prisma/client").ServiceOrderStatus,
                        voiceNumber, orderType, serviceType, customerName, address, dp, package: pkg, lea, woroTaskName, techContact, sales,
                        receivedDate: new Date(),
                        completedDate: isCompleted ? new Date() : null,
                        returnReason: isReturned ? SODReturnClassifierService.classify(cleanStatus || 'Returned in Excel Import').category : null,
                        comments: isReturned ? `[AI_CLASSIFIED] Reason: ${cleanStatus || 'Returned in Excel Import'}` : null
                    });
                }
            })());
            if (err) {
                failed++;
                errors.push(err instanceof Error ? ErrorUtil.getMessage(err) : String(err));
            }
        }

        // Batch Insert
        if (toCreate.length > 0) {
            const [err, res] = await safe(prisma.serviceOrder.createMany({ data: toCreate, skipDuplicates: true }));
            if (err || !res) {
                failed += toCreate.length;
                errors.push(`Failed to batch create: ${String(err)}`);
            } else {
                created += res.count;
            }
        }

        // Sequential Updates (Chunked)
        const updateChunks = [];
        for (let i = 0; i < toUpdate.length; i += 20) {
            updateChunks.push(toUpdate.slice(i, i + 20));
        }

        const { SODMaterialService } = await import('./sod.material.service');
        const { LedgerService } = await import('../finance/ledger.service');
        const { applySodStatus } = await import('./sync/sod-status.writer');

        for (const chunk of updateChunks) {
            await Promise.all(chunk.map(async ({ existing, updateData }) => {
                // The status columns belong to the single writer. An operator curating a spreadsheet
                // is a privileged ERP action, so it keeps always-allow authority ('API') but stops
                // writing the columns itself: history rows, the anchor and the status event are then
                // produced once, by the same code path every other writer uses.
                const {
                    sltsStatus: intentSltsStatus,
                    status: intentStatus,
                    completedDate: intentCompletedDate,
                    returnReason: intentReturnReason,
                    ...fieldPayload
                } = updateData;
                const nextSltsStatus = intentSltsStatus as string | null | undefined;
                const isReturning = (nextSltsStatus === 'RETURN' && existing.sltsStatus !== 'RETURN');

                const [err] = await safe(prisma.$transaction(async (tx) => {
                    await applySodStatus({
                        sodId: existing.id,
                        soNum: existing.soNum,
                        opmcId: opmcId as UUID,
                        next: {
                            sltsStatus: nextSltsStatus,
                            status: intentStatus as string | null | undefined,
                            completedDate: intentCompletedDate as Date | string | null | undefined,
                            returnReason: intentReturnReason as string | null | undefined,
                        },
                        // The import carries no portal status instant, so the anchor is left alone.
                        anchor: null,
                        actor: 'API',
                        reason: 'EXCEL_IMPORT',
                        tx,
                    });

                    if (Object.keys(fieldPayload).length > 0) {
                        await tx.serviceOrder.update({ where: { id: existing.id }, data: fieldPayload });
                    }
                    if (isReturning) {
                        await SODMaterialService.rollbackMaterialUsage(tx, existing.id, 'EXCEL_IMPORT');
                        await LedgerService.rollbackSodTransaction(tx, existing.id);
                    }
                }));
                if (err) {
                    failed++;
                    errors.push(err instanceof Error ? ErrorUtil.getMessage(err) : String(err));
                } else {
                    created++;
                }
            }));
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
        const inventoryItems = await prisma.inventoryItem.findMany({
            select: { id: true, code: true, name: true, importAliases: true, scrapedAliases: true, bomAliases: true, unitPrice: true, costPrice: true }
        });

        // Build alias -> itemId map from all alias groups (deterministic: sorted by code, first wins)
        const aliasMap: Record<string, string> = {};
        const sortedItems = [...inventoryItems].sort((a, b) => a.code.localeCompare(b.code));
        for (const item of sortedItems) {
            const allAliases = [
                ...(item.importAliases || []),
                ...(item.scrapedAliases || []),
                ...(item.bomAliases || [])
            ];
            for (const alias of allAliases) {
                const key = alias.toUpperCase().trim();
                if (!key) continue;
                if (aliasMap[key] && aliasMap[key] !== item.id) {
                    console.warn('[SOD Import] Alias collision:', key, 'kept', aliasMap[key], 'ignored', item.id);
                    continue;
                }
                aliasMap[key] = item.id;
            }
        }

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

        // Fetch configs globally
        const allRevConfigs = await prisma.sODRevenueConfig.findMany({
            where: { isActive: true },
            orderBy: { rtomId: { sort: 'asc', nulls: 'last' } }
        });
        const revConfigMap = new Map<string | null, typeof allRevConfigs[0]>();
        allRevConfigs.forEach(c => revConfigMap.set(c.rtomId, c));

        const allPayConfigs = await prisma.contractorPaymentConfig.findMany({
            where: { isActive: true },
            include: { tiers: true },
            orderBy: { rtomId: { sort: 'asc', nulls: 'last' } }
        });
        const payConfigMap = new Map<string | null, typeof allPayConfigs[0]>();
        allPayConfigs.forEach(c => payConfigMap.set(c.rtomId, c));

        const inventoryItemMap = new Map<string, typeof inventoryItems[0]>();
        inventoryItems.forEach(i => inventoryItemMap.set(i.id, i));

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
                const [err] = await safe((async () => {
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
                        return;
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

                    const { ContractorLifecycleService } = await import('../contractor/contractor.lifecycle.service');
                    const contractorId = row.contractorName
                        ? await ContractorLifecycleService.resolveOrCreateContractorForOpmc(row.contractorName, opmc.id)
                        : null;

                    let revenueAmount = 0;
                    let contractorAmount = 0;

                    const revConfig = revConfigMap.get(opmc.id) || revConfigMap.get(null);
                    if (revConfig) revenueAmount = Number(revConfig.revenuePerSOD ?? 0);

                    const payConfig = payConfigMap.get(opmc.id) || payConfigMap.get(null);
                    if (payConfig && payConfig.tiers && payConfig.tiers.length > 0) {
                        const dist = row.dropWireDistance || 0;
                        const matchingTier = payConfig.tiers.find(t => dist >= Number(t.minDistance) && dist <= Number(t.maxDistance));
                        if (matchingTier) contractorAmount = Number(matchingTier.amount);
                        else {
                            const sorted = [...payConfig.tiers].sort((a, b) => Number(b.maxDistance) - Number(a.maxDistance));
                            if (dist > Number(sorted[0].maxDistance)) contractorAmount = Number(sorted[0].amount);
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

                    if (!skipMaterials && row.materials && typeof row.materials === 'object') {
                        const mats = row.materials as Record<string, unknown>;
                        for (const [key, val] of Object.entries(mats)) {
                            const rawQty = Number(val);
                            if (isNaN(rawQty) || rawQty <= 0) continue;
                            const qtyVal = Math.floor(rawQty);

                            const aliasKey = key.toUpperCase().trim();
                            const mappedItemId = aliasMap[aliasKey];

                            if (mappedItemId) {
                                const item = inventoryItemMap.get(mappedItemId);
                                if (item) {
                                    materialUsageData.push({
                                        itemId: item.id,
                                        quantity: qtyVal,
                                        unit: 'Nos',
                                        usageType: 'USED',
                                        unitPrice: Number(item.unitPrice || 0),
                                        costPrice: Number(item.costPrice || 0)
                                    });
                                }
                            } else {
                                const item = inventoryItems.find(i => 
                                    i.code.toUpperCase() === aliasKey || 
                                    i.name.toUpperCase().includes(aliasKey)
                                );
                                if (item) {
                                    materialUsageData.push({
                                        itemId: item.id,
                                        quantity: qtyVal,
                                        unit: 'Nos',
                                        usageType: 'USED',
                                        unitPrice: Number(item.unitPrice || 0),
                                        costPrice: Number(item.costPrice || 0)
                                    });
                                }
                            }
                        }
                    }

                    const createData: Prisma.ServiceOrderUncheckedCreateInput = {
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

                    await prisma.serviceOrder.create({
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
                })());
                if (err) {
                    const errorMsg = err instanceof Error ? ErrorUtil.getMessage(err) : 'Unknown error';
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
