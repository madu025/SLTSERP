import * as XLSX from 'xlsx';
import * as fs from 'fs';
import { prisma } from '../src/lib/prisma';
import { ServiceOrderStatus, PatStatusEnum } from '@prisma/client';

const filePath = `C:\\Users\\Prasad\\Downloads\\Invoice\\FN Material Reports-2026\\FN Material Reports-2026\\FN January Per Line Material Report-2026.xlsm`;

// Config mapping Excel material header -> DB Inventory Item Code & Usage Type
const MATERIAL_MAPPING_CONFIG: Record<string, { code: string; usageType: string }> = {
    'PLC-5_6-CE': { code: 'OSP-POLE-5.6LL', usageType: 'USED' },
    'PLC-6_7-CE': { code: 'OSP-POLE-6.7LL', usageType: 'USED' },
    'PLC-8': { code: 'OSP-POLE-8MH', usageType: 'USED' },
    'F1': { code: 'OSP-HC-CBL-DW', usageType: 'USED_F1' },              // Outdoor Drop Wire Cable (m)
    'G1': { code: 'OSP-HC-CBL-DW', usageType: 'USED_G1' },              // Indoor Drop Wire Cable (m)
    'FDW WASTAGE': { code: 'OSP-HC-CBL-DW', usageType: 'WASTAGE' },     // Drop Wire Wastage (m)
    'DW-RT': { code: 'OSP-NC-ACC-DWRETNER', usageType: 'USED' },        // Drop Wire Retainers (Nos)
    'L-HOOK': { code: 'OSP-NC-MM-LHOOK', usageType: 'USED' },
    'C-HOOK': { code: 'OSP-NC-MM-CHOOK', usageType: 'USED' },
    'TOP BOLT': { code: 'OSP-NC-MM-NUT&B-1/2 x 61/2', usageType: 'USED' },
    'E 1- ROSSET': { code: 'OSPFTA007', usageType: 'USED' },
    'FAC CONNECTORS': { code: 'OSP-HC-ACC-FAC', usageType: 'USED' },
    'IN-W SINGLE PAIR': { code: 'OSP-CC-CAB-INTNALTC-1X0.65MM', usageType: 'USED' },
    'CABLE CAT5E': { code: 'ITEACC046', usageType: 'USED' },
    'CABLE TIE (PCs)': { code: 'HDB-HDW-CTIE-4', usageType: 'USED' },
    'CONDUIT (m)': { code: 'HDB-CON-PIPE-1/2', usageType: 'USED' },
    'CONDUIT CLIPS': { code: 'HDB-HDW-ECON-CLIP-1/2', usageType: 'USED' },
    'CON-NAIL': { code: 'HDB-HDW-CNAIL-1', usageType: 'USED' },
    'FLEXIBLE': { code: 'HDB-FLEX-CON-1/4-W', usageType: 'USED' },
    'CONNECTOR  RJ11': { code: 'NWE-ACC-RJ11', usageType: 'USED' },
    'SINGLE ROSETTE': { code: 'HDB-HDW-ROSET-1', usageType: 'USED' },
    'U CLIP': { code: 'OSP-ACC-UCLIP-4M', usageType: 'USED' },
    'CONNECTOR RJ 45': { code: 'NWE-ACC-RJ45', usageType: 'USED' },
    'CASING': { code: 'HDB-TRUNK-16x12.5', usageType: 'USED' },
};

function resolveAreaGroup(rtomOrName?: string | null): 'CEN' | 'HK' | 'OTHER' {
    if (!rtomOrName) return 'OTHER';
    const u = rtomOrName.trim().toUpperCase();
    if (u.includes('MD') || u.includes('CEN')) return 'CEN';
    if (u.includes('HK')) return 'HK';
    return 'OTHER';
}

async function importJanuaryMaterialReport() {
    console.log('🚀 Starting Refined January 2026 Material Report Import...');
    console.log(`Source File: ${filePath}`);

    if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
    }

    // 1. Pre-load reference maps from Database sequentially to respect connection pool limits
    console.log('📦 Loading database reference caches...');
    const opmcs = await prisma.oPMC.findMany({ select: { id: true, name: true, rtom: true } });
    const teams = await prisma.contractorTeam.findMany({ select: { id: true, contractorId: true, name: true, sltCode: true } });
    const contractors = await prisma.contractor.findMany({ select: { id: true, name: true, registrationNumber: true } });
    const items = await prisma.inventoryItem.findMany({ select: { id: true, code: true, name: true, unit: true, unitPrice: true } });
    const rateRules = await prisma.contractorRateRule.findMany({ where: { isActive: true }, orderBy: { minDistance: 'desc' } });

    // Build OPMC Lookup Map
    const opmcMap = new Map<string, string>();
    opmcs.forEach(o => {
        const cleanRtom = o.rtom.toUpperCase().replace(/^R-/, '').trim();
        opmcMap.set(cleanRtom, o.id);
        opmcMap.set(o.rtom.toUpperCase().trim(), o.id);
    });

    // Build Contractor Team Lookup Map
    const teamMap = new Map<string, { teamId: string; contractorId: string | null }>();
    teams.forEach(t => {
        if (t.sltCode) teamMap.set(t.sltCode.toUpperCase().trim(), { teamId: t.id, contractorId: t.contractorId });
        if (t.name) teamMap.set(t.name.toUpperCase().trim(), { teamId: t.id, contractorId: t.contractorId });
    });

    // Build Contractor Lookup Map
    const contractorMap = new Map<string, string>();
    contractors.forEach(c => {
        if (c.name) contractorMap.set(c.name.toUpperCase().trim(), c.id);
        if (c.registrationNumber) contractorMap.set(c.registrationNumber.toUpperCase().trim(), c.id);
    });

    // Build Inventory Item Lookup Map
    const itemByCode = new Map<string, { id: string; unit: string; unitPrice: number }>();
    items.forEach(i => itemByCode.set(i.code, { id: i.id, unit: i.unit || '', unitPrice: Number(i.unitPrice || 0) }));

    // Fallback OPMC (R-AD) if any RTOM is missing
    const fallbackOpmcId = opmcMap.get('AD') || opmcs[0]?.id;

    // Fast In-Memory Rate Calculation
    function computeAmountsInMemory(rtomCode: string, distance: number) {
        const areaGroup = resolveAreaGroup(rtomCode);
        const matchingRule = rateRules.find(r => 
            r.workType === 'FTTH' &&
            r.areaGroup === areaGroup &&
            r.minDistance <= distance &&
            r.maxDistance >= distance
        ) || rateRules.find(r =>
            r.workType === 'FTTH' &&
            r.minDistance <= distance &&
            r.maxDistance >= distance
        );

        let contractorAmount = 6750;
        if (matchingRule) {
            contractorAmount = Number(matchingRule.rateAmount);
        } else {
            const baseRate = areaGroup === 'OTHER' ? 6650 : 6750;
            const cappedDist = Math.min(Math.max(0, distance), 180);
            const excessDistance = Math.max(0, cappedDist - 50);
            contractorAmount = baseRate + (excessDistance * 35);
        }

        return {
            revenueAmount: 7500,
            contractorAmount
        };
    }

    // 2. Read Excel Sheet
    console.log('📖 Reading Excel workbook...');
    const buf = fs.readFileSync(filePath);
    const wb = XLSX.read(buf, { type: 'buffer', cellDates: true });
    const ws = wb.Sheets['SOFT'];

    if (!ws) {
        throw new Error('Sheet "SOFT" not found in January report workbook.');
    }

    const rawRows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });
    const headers = rawRows[1].map(h => String(h || '').trim());

    // Header column indices
    const colIdx = {
        soNum: headers.findIndex(h => h.toUpperCase().includes('SOD NUMBER')),
        cusName: headers.findIndex(h => h.toUpperCase().includes('CUSTOMER NAME')),
        address: headers.findIndex(h => h.toUpperCase().includes('CUSTOMER ADDRESS')),
        rtom: headers.findIndex(h => h.toUpperCase() === 'RTOM'),
        lea: headers.findIndex(h => h.toUpperCase().includes('EX AREA')),
        voiceNumber: headers.findIndex(h => h.toUpperCase().includes('TP NUMBER')),
        orderType: headers.findIndex(h => h.toUpperCase().includes('SERVICE ORDER TYPE')),
        techContact: headers.findIndex(h => h.toUpperCase().includes('CUSTOMER CONTACT')),
        dp: headers.findIndex(h => h.toUpperCase() === 'DP NO'),
        receivedDate: headers.findIndex(h => h.toUpperCase().includes('SOD RECEIVED DATE')),
        completedDate: headers.findIndex(h => h.toUpperCase().includes('SOD COMPLETE DATE')),
        package: headers.findIndex(h => h.toUpperCase().includes('FTTH_PACKAGE')),
        f1: headers.findIndex(h => h.toUpperCase() === 'F1'),
        g1: headers.findIndex(h => h.toUpperCase() === 'G1'),
        dwRt: headers.findIndex(h => h.toUpperCase() === 'DW-RT'),
        directLabor: headers.findIndex(h => h.toUpperCase().includes('DIRECT LABOR')),
        contractorName: headers.findIndex(h => h.toUpperCase().includes('CONTRACTOR NAMES')),
        poleNumber: headers.findIndex(h => h.toUpperCase() === 'POLE NUMBER'),
    };

    // Active material columns map
    const activeMaterialCols: { header: string; colIdx: number; item: { id: string; unit: string; unitPrice: number }; usageType: string }[] = [];
    headers.forEach((h, idx) => {
        const config = MATERIAL_MAPPING_CONFIG[h];
        if (config) {
            const item = itemByCode.get(config.code);
            if (item) {
                activeMaterialCols.push({
                    header: h,
                    colIdx: idx,
                    item,
                    usageType: config.usageType
                });
            }
        }
    });

    console.log(`Matched ${activeMaterialCols.length} material columns.`);

    // Parse and Aggregate SOD rows by soNum
    console.log(' Parsing and aggregating SOD rows with refined F1/G1 Outdoor/Indoor Drop Wire & DW-RT Retainers...');
    const sodMap = new Map<string, any>();

    for (let i = 2; i < rawRows.length; i++) {
        const row = rawRows[i];
        if (!row || !Array.isArray(row)) continue;

        let soNum = String(row[colIdx.soNum] || '').trim();
        if (!soNum || soNum.length < 5 || soNum.toUpperCase().includes('TOTAL')) continue;

        if (soNum.toUpperCase() === 'MANUAL') {
            const tpNum = String(row[colIdx.voiceNumber] || '').trim();
            soNum = tpNum ? `MANUAL-${tpNum}` : `MANUAL-ROW-${i}`;
        }

        const rtomRaw = String(row[colIdx.rtom] || '').trim();
        const cleanRtom = rtomRaw.toUpperCase().replace(/^R-/, '');
        const opmcId = opmcMap.get(cleanRtom) || fallbackOpmcId;

        const laborStr = String(row[colIdx.directLabor] || '').trim();
        const contrStr = String(row[colIdx.contractorName] || '').trim();
        const teamKey = (laborStr || contrStr).toUpperCase();

        let matchedTeamId: string | null = null;
        let matchedContractorId: string | null = null;

        if (teamKey) {
            const foundTeam = teamMap.get(teamKey);
            if (foundTeam) {
                matchedTeamId = foundTeam.teamId;
                matchedContractorId = foundTeam.contractorId;
            } else {
                const foundContractorId = contractorMap.get(teamKey);
                if (foundContractorId) {
                    matchedContractorId = foundContractorId;
                }
            }
        }

        // F1 = Outdoor Drop Wire (m), G1 = Indoor Drop Wire (m)
        const f1Meters = parseFloat(row[colIdx.f1]) || 0;
        const g1Meters = parseFloat(row[colIdx.g1]) || 0;
        // Total Drop Wire Distance for connection = F1 + G1 (or F1)
        const dropWireDistance = (f1Meters + g1Meters) > 0 ? (f1Meters + g1Meters) : 0;

        const parseExcelDate = (val: any): Date | null => {
            if (!val) return null;
            const d = val instanceof Date ? val : new Date(val);
            if (isNaN(d.getTime())) return null;
            return new Date(d.getTime() + 12 * 3600 * 1000);
        };

        const receivedDate = parseExcelDate(row[colIdx.receivedDate]);
        const completedDate = parseExcelDate(row[colIdx.completedDate]);

        const { revenueAmount, contractorAmount } = computeAmountsInMemory(rtomRaw || 'AD', dropWireDistance);

        const poleNumStr = colIdx.poleNumber >= 0 ? String(row[colIdx.poleNumber] || '').trim() : '';
        const validPoleNum = poleNumStr && poleNumStr !== 'null' && poleNumStr !== 'undefined' ? poleNumStr : null;

        // Parse Materials for this row
        const rowMaterials: { itemId: string; quantity: number; unit: string; usageType: string; unitPrice: number; comment?: string | null; serialNumber?: string | null }[] = [];
        for (const m of activeMaterialCols) {
            const qty = parseFloat(row[m.colIdx]);
            if (!isNaN(qty) && qty > 0) {
                const isPole = m.header.startsWith('PLC-');
                rowMaterials.push({
                    itemId: m.item.id,
                    quantity: qty,
                    unit: m.item.unit,
                    usageType: m.usageType,
                    unitPrice: m.item.unitPrice,
                    comment: isPole && validPoleNum ? `Pole No: ${validPoleNum}` : null,
                    serialNumber: null
                });
            }
        }

        const existingSod = sodMap.get(soNum);
        if (existingSod) {
            // Aggregate materials for duplicate soNum
            for (const mat of rowMaterials) {
                const existingMat = existingSod.materials.find(
                    (m: any) => m.itemId === mat.itemId && m.usageType === mat.usageType
                );
                if (existingMat) {
                    existingMat.quantity += mat.quantity;
                } else {
                    existingSod.materials.push({ ...mat });
                }
            }
            if (!existingSod.teamId && matchedTeamId) existingSod.teamId = matchedTeamId;
            if (!existingSod.contractorId && matchedContractorId) existingSod.contractorId = matchedContractorId;
            if (!existingSod.directTeam && (laborStr || contrStr)) existingSod.directTeam = (laborStr || contrStr);
        } else {
            sodMap.set(soNum, {
                soNum,
                customerName: String(row[colIdx.cusName] || '').trim() || null,
                address: String(row[colIdx.address] || '').trim() || null,
                rtom: rtomRaw || 'AD',
                opmcId,
                lea: String(row[colIdx.lea] || '').trim() || null,
                voiceNumber: String(row[colIdx.voiceNumber] || '').trim() || null,
                orderType: String(row[colIdx.orderType] || '').trim() || null,
                techContact: String(row[colIdx.techContact] || '').trim() || null,
                dp: String(row[colIdx.dp] || '').trim() || null,
                receivedDate: (receivedDate && !isNaN(receivedDate.getTime())) ? receivedDate : null,
                completedDate: (completedDate && !isNaN(completedDate.getTime())) ? completedDate : null,
                package: String(row[colIdx.package] || '').trim() || null,
                dropWireDistance,
                revenueAmount,
                contractorAmount,
                directTeam: (laborStr || contrStr) || null,
                teamId: matchedTeamId,
                contractorId: matchedContractorId,
                materials: rowMaterials
            });
        }
    }

    const sodRows = Array.from(sodMap.values());
    console.log(`Total aggregated unique SOD rows to import: ${sodRows.length}`);

    // 3. Perform Transactional Batch Import in small batches (BATCH_SIZE = 100) using chunked queries
    const BATCH_SIZE = 100;
    let totalProcessed = 0;
    let totalCreated = 0;
    let totalUpdated = 0;
    let totalMaterialLinesCreated = 0;
    let totalTeamsLinked = 0;

    for (let i = 0; i < sodRows.length; i += BATCH_SIZE) {
        const batchSODData = sodRows.slice(i, i + BATCH_SIZE);
        const batchSoNums = batchSODData.map(b => b.soNum);

        await prisma.$transaction(async (tx) => {
            // Find existing SODs in this batch
            const existingInDb = await tx.serviceOrder.findMany({
                where: { soNum: { in: batchSoNums } },
                select: { id: true, soNum: true }
            });
            const existingMap = new Map<string, string>(existingInDb.map(e => [e.soNum, e.id]));

            const sodIdsForMaterialCleanup: string[] = [];

            // Process SOD upserts in sequential chunks of 10 to keep connection usage minimal
            const CONCURRENCY_CHUNK = 10;
            for (let c = 0; c < batchSODData.length; c += CONCURRENCY_CHUNK) {
                const chunk = batchSODData.slice(c, c + CONCURRENCY_CHUNK);
                await Promise.all(chunk.map(async (sod) => {
                    const existingId = existingMap.get(sod.soNum);

                    if (existingId) {
                        // Update Existing SOD
                        await tx.serviceOrder.update({
                            where: { id: existingId },
                            data: {
                                rtom: sod.rtom,
                                opmcId: sod.opmcId,
                                lea: sod.lea,
                                customerName: sod.customerName,
                                address: sod.address,
                                voiceNumber: sod.voiceNumber,
                                orderType: sod.orderType,
                                techContact: sod.techContact,
                                dp: sod.dp,
                                package: sod.package,
                                receivedDate: sod.receivedDate,
                                completedDate: sod.completedDate,
                                dropWireDistance: sod.dropWireDistance,
                                revenueAmount: sod.revenueAmount,
                                contractorAmount: sod.contractorAmount,
                                status: ServiceOrderStatus.INSTALL_CLOSED,
                                sltsStatus: ServiceOrderStatus.INSTALL_CLOSED,
                                isInvoicable: true,
                                sltsPatStatus: PatStatusEnum.PAT_PASSED,
                                opmcPatStatus: PatStatusEnum.PAT_PASSED,
                                ...(sod.teamId ? { teamId: sod.teamId } : {}),
                                ...(sod.contractorId ? { contractorId: sod.contractorId } : {}),
                                ...(sod.directTeam ? { directTeam: sod.directTeam } : {}),
                            }
                        });
                        sodIdsForMaterialCleanup.push(existingId);
                        totalUpdated++;
                        if (sod.teamId || sod.contractorId) totalTeamsLinked++;
                    } else {
                        // Create New SOD
                        const createdSod = await tx.serviceOrder.create({
                            data: {
                                soNum: sod.soNum,
                                rtom: sod.rtom,
                                opmcId: sod.opmcId,
                                lea: sod.lea,
                                customerName: sod.customerName,
                                address: sod.address,
                                voiceNumber: sod.voiceNumber,
                                orderType: sod.orderType,
                                techContact: sod.techContact,
                                dp: sod.dp,
                                package: sod.package,
                                receivedDate: sod.receivedDate,
                                completedDate: sod.completedDate,
                                dropWireDistance: sod.dropWireDistance,
                                revenueAmount: sod.revenueAmount,
                                contractorAmount: sod.contractorAmount,
                                status: ServiceOrderStatus.INSTALL_CLOSED,
                                sltsStatus: ServiceOrderStatus.INSTALL_CLOSED,
                                isInvoicable: true,
                                sltsPatStatus: PatStatusEnum.PAT_PASSED,
                                opmcPatStatus: PatStatusEnum.PAT_PASSED,
                                teamId: sod.teamId || undefined,
                                contractorId: sod.contractorId || undefined,
                                directTeam: sod.directTeam || undefined,
                                isLegacyImport: true,
                            }
                        });
                        existingMap.set(sod.soNum, createdSod.id);
                        sodIdsForMaterialCleanup.push(createdSod.id);
                        totalCreated++;
                        if (sod.teamId || sod.contractorId) totalTeamsLinked++;
                    }
                }));
            }

            // Cleanup old material usage for batch SODs
            if (sodIdsForMaterialCleanup.length > 0) {
                await tx.sODMaterialUsage.deleteMany({
                    where: { serviceOrderId: { in: sodIdsForMaterialCleanup } }
                });
            }

            // Prepare new material usage records
            const materialUsageCreates: any[] = [];
            for (const sod of batchSODData) {
                const sodId = existingMap.get(sod.soNum);
                if (!sodId) continue;

                for (const mat of sod.materials) {
                    materialUsageCreates.push({
                        serviceOrderId: sodId,
                        itemId: mat.itemId,
                        quantity: mat.quantity,
                        unit: mat.unit,
                        usageType: mat.usageType,
                        unitPrice: mat.unitPrice,
                        costPrice: mat.unitPrice,
                        comment: mat.comment || null,
                    });
                }
            }

            if (materialUsageCreates.length > 0) {
                await tx.sODMaterialUsage.createMany({
                    data: materialUsageCreates
                });
                totalMaterialLinesCreated += materialUsageCreates.length;
            }
        }, {
            timeout: 60000,
            maxWait: 10000
        });

        totalProcessed += batchSODData.length;
        console.log(` Progress: ${totalProcessed}/${sodRows.length} SODs imported (${Math.round((totalProcessed / sodRows.length) * 100)}%)`);
    }

    console.log('\n==================================================');
    console.log('🎉 REFINED JANUARY 2026 MATERIAL IMPORT COMPLETED!');
    console.log('==================================================');
    console.log(`Total SODs Processed: ${totalProcessed}`);
    console.log(`Existing SODs Updated: ${totalUpdated}`);
    console.log(`New SODs Created: ${totalCreated}`);
    console.log(`Contractor / Teams Linked: ${totalTeamsLinked}`);
    console.log(`Material Usage Lines Written: ${totalMaterialLinesCreated}`);
    console.log('==================================================\n');

    await prisma.$disconnect();
}

importJanuaryMaterialReport().catch((err) => {
    console.error('❌ Import Failed with Error:', err);
    process.exit(1);
});
