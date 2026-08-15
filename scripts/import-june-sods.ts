/**
 * import-june-sods.ts
 *
 * Imports 2026 completed SODs from FN Material Report Excel files (Jan-Jun).
 * Skips SODs that already exist in the system.
 *
 * Usage: npx tsx scripts/import-june-sods.ts [--apply] [--month=January]
 *        Without --month, imports all months.
 */
import 'dotenv/config';
import * as XLSX from 'xlsx';
import * as path from 'path';
import { primaryClient } from '../src/lib/prisma';
import { SODInvoicingService } from '../src/services/service-order/sod.invoicing.service';

const APPLY = process.argv.includes('--apply');
const DEFAULT_REVENUE = 10500;

const baseDir = path.join('D:', 'MyProject', 'SLTSERP', 'FN Material Reports-2026', 'FN Material Reports-2026');

const monthArg = process.argv.find(a => a.startsWith('--month='));
const targetMonth = monthArg ? monthArg.split('=')[1] : null;

// Each month: filename, sheet name, column layout
interface MonthConfig {
    filename: string;
    sheetName: string;
    cols: {
        sarm: number;       // -1 if not present
        soNum: number;
        customerName: number;
        address: number;
        rtom: number;
        lea: number;
        voiceNumber: number;
        orderType: number;
        contact: number;
        dpNo: number;
        receivedDate: number;
        completedDate: number;
        serviceType: number;
    };
}

const STANDARD_COLS = {
    sarm: 1, soNum: 2, customerName: 3, address: 4, rtom: 5, lea: 6,
    voiceNumber: 7, orderType: 8, contact: 9, dpNo: 11,
    receivedDate: 13, completedDate: 14, serviceType: 16,
};

// April has no SARM column, everything shifts left by 1
const APRIL_COLS = {
    sarm: -1, soNum: 1, customerName: 2, address: 3, rtom: 4, lea: 5,
    voiceNumber: 6, orderType: 7, contact: 8, dpNo: 10,
    receivedDate: 12, completedDate: 13, serviceType: 15,
};

const MONTHS: Record<string, MonthConfig> = {
    'January':  { filename: 'FN January Per Line Material Report-2026.xlsm',  sheetName: 'SOFT',            cols: STANDARD_COLS },
    'February': { filename: 'FN February Per Line Material Report-2026.xlsm', sheetName: 'Material Report', cols: STANDARD_COLS },
    'March':    { filename: 'FN March Per Line Material Report-2026.xlsm',    sheetName: 'SOFT',            cols: STANDARD_COLS },
    'April':    { filename: 'FN April Per Line Material Report 2026.xlsx',    sheetName: 'Sheet1',          cols: APRIL_COLS },
    'May':      { filename: 'FN May Per Line Material Report-2026.xlsm',      sheetName: 'SOFT',            cols: STANDARD_COLS },
    'June':     { filename: 'FN June Per Line Material Report-2026.xlsm',     sheetName: 'SOFT',            cols: STANDARD_COLS },
};

function excelSerialToDate(serial: number): Date | null {
    if (!serial || serial < 1 || typeof serial !== 'number') return null;
    const utcDays = Math.floor(serial - 25569);
    const utcMs = utcDays * 86400 * 1000;
    return new Date(utcMs);
}

async function main() {
    console.log(`2026 SOD Importer - ${APPLY ? 'APPLY MODE' : 'DRY-RUN MODE'}`);

    const monthsToProcess = targetMonth
        ? Object.entries(MONTHS).filter(([m]) => m.toLowerCase() === targetMonth.toLowerCase())
        : Object.entries(MONTHS);

    if (targetMonth && monthsToProcess.length === 0) {
        console.log(`Unknown month: ${targetMonth}. Available: ${Object.keys(MONTHS).join(', ')}`);
        process.exit(1);
    }

    // Phase 1: Read all Excel files and extract records
    const allRecords: any[] = [];
    const seenSoNums = new Set<string>(); // dedupe across months

    for (const [month, config] of monthsToProcess) {
        const filePath = path.join(baseDir, config.filename);
        console.log(`\nReading ${month}: ${config.filename}...`);

        let wb: XLSX.WorkBook;
        try {
            wb = XLSX.readFile(filePath);
        } catch (err: any) {
            console.log(`  ERROR reading file: ${err.message}`);
            continue;
        }

        const ws = wb.Sheets[config.sheetName];
        if (!ws) {
            console.log(`  No "${config.sheetName}" sheet. Available: ${wb.SheetNames.slice(0, 5).join(', ')}...`);
            continue;
        }

        const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null }) as any[][];
        console.log(`  Sheet: ${data.length} rows`);

        const c = config.cols;
        let monthCount = 0;
        let monthDupes = 0;

        for (let i = 2; i < data.length; i++) {
            const row = data[i];
            const soNum = row[c.soNum];
            if (!soNum || typeof soNum !== 'string' || !soNum.trim()) continue;

            const trimmed = soNum.trim();
            if (seenSoNums.has(trimmed)) {
                monthDupes++;
                continue; // duplicate across months
            }
            seenSoNums.add(trimmed);

            allRecords.push({
                soNum: trimmed,
                month,
                sarm: c.sarm >= 0 ? row[c.sarm] : null,
                customerName: row[c.customerName],
                address: row[c.address],
                rtom: row[c.rtom],
                lea: row[c.lea],
                voiceNumber: row[c.voiceNumber],
                orderType: row[c.orderType],
                contact: row[c.contact],
                dpNo: row[c.dpNo],
                receivedDate: excelSerialToDate(row[c.receivedDate]),
                completedDate: excelSerialToDate(row[c.completedDate]),
                serviceType: row[c.serviceType],
            });
            monthCount++;
        }
        console.log(`  Extracted: ${monthCount} SODs (${monthDupes} cross-month dupes skipped)`);
    }

    console.log(`\nTotal unique records from Excel: ${allRecords.length}`);

    // Phase 2: Check which already exist in DB
    const soNums = allRecords.map(r => r.soNum);
    const existing = await primaryClient.serviceOrder.findMany({
        where: { soNum: { in: soNums } },
        select: { soNum: true },
    });
    const existingSet = new Set(existing.map(s => s.soNum));
    const toCreate = allRecords.filter(r => !existingSet.has(r.soNum));

    console.log(`Already in DB: ${existing.length}`);
    console.log(`To create: ${toCreate.length}`);

    if (toCreate.length === 0) {
        console.log('\nNo new SODs to create.');
        await primaryClient.$disconnect();
        return;
    }

    // Phase 3: Fetch OPMC mapping
    const opmcs = await primaryClient.oPMC.findMany({
        select: { id: true, rtom: true, name: true },
    });
    const opmcByRtom = new Map<string, { id: string; name: string }>();
    for (const o of opmcs) {
        const code = o.rtom.replace(/^R-/, '').toUpperCase();
        opmcByRtom.set(code, { id: o.id, name: o.name });
        opmcByRtom.set(o.rtom.toUpperCase(), { id: o.id, name: o.name });
    }

    // Revenue config
    const revenueConfig = await primaryClient.sODRevenueConfig.findFirst({
        where: { rtomId: null, isActive: true },
    });
    const revenuePerSOD = revenueConfig ? Number(revenueConfig.revenuePerSOD) : DEFAULT_REVENUE;
    console.log(`Revenue per SOD: ${revenuePerSOD}`);

    if (!APPLY) {
        console.log('\nDRY-RUN: no changes made. Re-run with --apply to create SODs.');
        await primaryClient.$disconnect();
        return;
    }

    // Phase 4: Create SODs in batches
    let created = 0;
    let failed = 0;
    const batchSize = 100;
    const unknownRtoms = new Set<string>();

    for (let i = 0; i < toCreate.length; i += batchSize) {
        const batch = toCreate.slice(i, i + batchSize);
        const batchData: any[] = [];

        for (const rec of batch) {
            const rtomCode = (rec.rtom || '').toString().toUpperCase();
            const opmc = opmcByRtom.get(rtomCode);
            if (!opmc) {
                unknownRtoms.add(rtomCode);
                failed++;
                continue;
            }

            const areaGroup = SODInvoicingService.resolveAreaGroup(rtomCode);
            const contractorAmount = areaGroup === 'OTHER' ? 6650 : 6750;

            batchData.push({
                soNum: rec.soNum,
                rtom: rtomCode,
                opmcId: opmc.id,
                lea: rec.lea || null,
                voiceNumber: rec.voiceNumber ? String(rec.voiceNumber) : null,
                orderType: rec.orderType || null,
                serviceType: rec.serviceType || null,
                customerName: rec.customerName || null,
                address: rec.address || null,
                techContact: rec.contact ? String(rec.contact) : null,
                dp: rec.dpNo ? String(rec.dpNo) : null,
                receivedDate: rec.receivedDate,
                completedDate: rec.completedDate,
                status: 'COMPLETED',
                sltsStatus: 'COMPLETED',
                revenueAmount: revenuePerSOD,
                contractorAmount: contractorAmount,
                isInvoicable: false,
                invoiced: false,
                isManualEntry: false,
                isLegacyImport: true,
                comments: `Imported from ${rec.month} 2026 FN Material Report. SARM: ${rec.sarm || 'N/A'}`,
            });
        }

        if (batchData.length > 0) {
            try {
                const result = await primaryClient.serviceOrder.createMany({
                    data: batchData,
                    skipDuplicates: true,
                });
                created += result.count;
                console.log(`  Batch ${Math.floor(i / batchSize) + 1}: created ${result.count}`);
            } catch (err: any) {
                console.error(`  Batch ${Math.floor(i / batchSize) + 1} failed:`, err.message);
                failed += batchData.length;
            }
        }
    }

    if (unknownRtoms.size > 0) {
        console.log(`\nUnknown RTOM codes skipped: ${[...unknownRtoms].join(', ')}`);
    }

    console.log(`\n=== SUMMARY ===`);
    console.log(`Created: ${created}`);
    console.log(`Failed/Skipped: ${failed}`);
    console.log(`Already existed: ${existing.length}`);

    await primaryClient.$disconnect();
}

main().catch(async (err) => {
    console.error('Import failed:', err);
    await primaryClient.$disconnect();
    process.exit(1);
});
