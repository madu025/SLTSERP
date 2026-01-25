/* eslint-disable @typescript-eslint/no-explicit-any */
process.env.IS_WORKER = 'true';
import { Worker, Job } from 'bullmq';
import { redis } from '../lib/redis';
import { prisma } from '../lib/prisma';
import { QUEUE_NAMES } from '../lib/queue';

interface ImportRow {
    serialNo: number;
    rtom: string;
    voiceNumber: string;
    orderType: string;
    receivedDate: string | Date | null;
    completedDate: string | Date | null;
    package: string;
    dropWireDistance: number;
    contractorName: string;
    directTeamName: string;
    materials: Record<string, number>;
}

export const sodImportWorker = new Worker(
    QUEUE_NAMES.SOD_IMPORT,
    async (job: Job) => {
        const { rows, skipMaterials = false } = job.data as {
            rows: ImportRow[];
            skipMaterials?: boolean;
        };

        const totalRows = rows.length;
        let successCount = 0;
        let errorCount = 0;
        let skippedNoOpmc = 0;

        // 1. Preparation (Lookups)
        const allOpmcs = await prisma.oPMC.findMany({
            select: { id: true, rtom: true, storeId: true }
        });

        const opmcMap: Record<string, { id: string; rtom: string; storeId: string | null }> = {};
        for (const opmc of allOpmcs) {
            opmcMap[opmc.rtom.toUpperCase()] = opmc;
            const shortCode = opmc.rtom.replace('R-', '');
            opmcMap[shortCode.toUpperCase()] = opmc;
        }

        const inventoryItemsRaw = await (prisma.inventoryItem as any).findMany({
            select: { id: true, code: true, name: true, importAliases: true, unitPrice: true, costPrice: true }
        }) as unknown[];

        const inventoryItems = inventoryItemsRaw as Array<{
            id: string;
            code: string | null;
            name: string;
            importAliases: string[];
            unitPrice: number | null;
            costPrice: number | null;
        }>;

        const allContractors = await prisma.contractor.findMany({
            select: { id: true, name: true, opmcId: true }
        });

        const contractorMap: Record<string, Record<string, string>> = {};
        for (const c of allContractors) {
            if (c.opmcId) {
                if (!contractorMap[c.opmcId]) contractorMap[c.opmcId] = {};
                contractorMap[c.opmcId][c.name.toUpperCase().trim()] = c.id;
            }
        }

        const patRecords = await prisma.sLTPATStatus.findMany({
            select: { soNum: true, voiceNumber: true }
        });

        const voiceToSoMap: Record<string, string> = {};
        for (const p of patRecords) {
            if (p.voiceNumber) voiceToSoMap[p.voiceNumber.trim()] = p.soNum;
        }

        // 2. Processing
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            try {
                const rtomKey = (row.rtom || '').toUpperCase().trim();
                const opmc = opmcMap[rtomKey];

                if (!opmc) {
                    skippedNoOpmc++;
                    errorCount++;
                    continue;
                }

                const realVoiceNumber = (row.voiceNumber || '').trim();
                let soNum = voiceToSoMap[realVoiceNumber];

                if (!soNum) {
                    const legacyDate = row.completedDate ? new Date(row.completedDate) : new Date();
                    const yearMonth = `${legacyDate.getFullYear()}${String(legacyDate.getMonth() + 1).padStart(2, '0')}`;
                    const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
                    soNum = `${opmc.rtom.replace('R-', '')}-LEG-${yearMonth}-${randomSuffix}`;
                }

                const opmcContractors = contractorMap[opmc.id] || {};
                const contractorId = row.contractorName ? opmcContractors[row.contractorName.toUpperCase().trim()] || null : null;

                // Revenue & Payment Snapshots
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

                const materialUsageData: Array<{ itemId: string; quantity: number; unit: string; usageType: string; unitPrice: number; costPrice: number }> = [];
                if (!skipMaterials && row.materials) {
                    for (const [idOrAlias, quantity] of Object.entries(row.materials)) {
                        if (quantity && quantity > 0) {
                            const item = inventoryItems.find(item => item.id === idOrAlias || item.importAliases.includes(idOrAlias));
                            if (item) {
                                materialUsageData.push({
                                    itemId: item.id,
                                    quantity: quantity,
                                    unit: 'Nos',
                                    usageType: 'USED',
                                    unitPrice: item.unitPrice || 0,
                                    costPrice: item.costPrice || 0
                                });
                            }
                        }
                    }
                }

                // IDEMPOTENT Logic: Check if same SO Number already exists
                await prisma.$transaction(async (tx) => {
                    const existing = await tx.serviceOrder.findUnique({
                        where: { soNum },
                        select: { id: true, status: true }
                    });

                    const baseData = {
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
                        contractorId
                    };

                    if (existing) {
                        // Update existing order
                        await (tx.serviceOrder as any).update({
                            where: { id: existing.id },
                            data: baseData
                        });

                        // Replace material usage if not skipping
                        if (!skipMaterials && materialUsageData.length > 0) {
                            await tx.sODMaterialUsage.deleteMany({ where: { serviceOrderId: existing.id } });
                            await tx.sODMaterialUsage.createMany({
                                data: materialUsageData.map(m => ({ ...m, serviceOrderId: existing.id }))
                            });
                        }
                    } else {
                        // Create new order
                        await (tx.serviceOrder as any).create({
                            data: {
                                ...baseData,
                                ...(materialUsageData.length > 0 && {
                                    materialUsage: { create: materialUsageData }
                                })
                            }
                        });
                    }
                });

                successCount++;
            } catch (err) {
                console.error(`Row ${i} failed:`, err);
                errorCount++;
            }

            // Update progress every 50 rows
            if (i % 50 === 0) {
                await job.updateProgress(Math.round((i / totalRows) * 100));
            }
        }

        // 3. Update dashboard stats for affected OPMCs
        const affectedOpmcIds = Array.from(new Set(rows.map(r => {
            const rtomKey = (r.rtom || '').toUpperCase().trim();
            return opmcMap[rtomKey]?.id;
        }).filter(Boolean)));

        const { StatsService } = await import('../lib/stats.service');
        for (const opmcId of affectedOpmcIds) {
            await StatsService.syncOpmcStats(opmcId as string);
        }

        return {
            successCount,
            errorCount,
            skippedNoOpmc,
            totalRows
        };
    },
    { connection: redis as any }
);
