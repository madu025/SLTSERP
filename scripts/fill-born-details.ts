/**
 * TARGETED detail fill for bridge-born terminal SODs: the contractor-view
 * scrape carries no orderType/package/serviceType (etc.), so born rows show
 * "-" everywhere and land in the Daily Report's DT catch-all. Reads the SLT
 * API completed/approved lists and NULL-FILLS the missing fields — existing
 * values are never overwritten. Mirrors CompletedSODSyncService.bornDetailFill.
 * Scope is bounded: terminal rows missing any key detail (currently ~7 rows).
 */
import { sltApiService } from '../src/services/slt/slt-api.service';
import { prisma } from '../src/lib/prisma';

const WINDOW_START = '2026-06-01';
const WINDOW_END = '2026-09-03';

async function main() {
    const targets = await prisma.serviceOrder.findMany({
        where: {
            sltsStatus: { in: ['COMPLETED', 'INSTALL_CLOSED'] },
            OR: [
                { orderType: null }, { package: null }, { serviceType: null },
                { lea: null }, { woroSeit: null },
            ]
        },
        select: {
            id: true, soNum: true, opmcId: true, completedDate: true,
            orderType: true, package: true, serviceType: true, lea: true,
            woroTaskName: true, woroSeit: true, ftthInstSeit: true, ftthWifi: true,
            iptv: true, receivedDate: true, statusDate: true,
        }
    });
    console.log(`Targets (terminal rows with missing details): ${targets.length}`);
    for (const t of targets) console.log(`  ${t.soNum}`);

    const opmcIds = [...new Set(targets.map(t => t.opmcId).filter(Boolean))] as string[];
    const opmcs = await prisma.oPMC.findMany({ where: { id: { in: opmcIds } }, select: { id: true, rtom: true } });
    const rtoms = [...new Set(opmcs.map(o => o.rtom))];
    console.log('RTOMs to fetch:', rtoms.join(', '));

    const records = new Map<string, Record<string, string>>();
    for (const rtom of rtoms) {
        const [completedResults, approvedResults] = await Promise.all([
            sltApiService.fetchCompletedSODs(rtom, WINDOW_START, WINDOW_END),
            sltApiService.fetchApprovedSODs(rtom, WINDOW_START, WINDOW_END),
        ]);
        for (const rec of [...completedResults, ...approvedResults] as unknown as Record<string, string>[]) {
            if (rec?.SO_NUM && !records.has(rec.SO_NUM)) records.set(rec.SO_NUM, rec);
        }
        console.log(`  ${rtom}: ${completedResults.length} completed + ${approvedResults.length} approved`);
    }
    console.log(`Portal records resolved: ${records.size}`);

    let filled = 0; const unmatched: string[] = [];
    for (const t of targets) {
        const rec = records.get(t.soNum);
        if (!rec) { unmatched.push(t.soNum); continue; }
        const cd = t.completedDate;
        const fill: Record<string, string | Date> = {};
        if (!t.orderType && rec.ORDER_TYPE) fill.orderType = rec.ORDER_TYPE;
        if (!t.package && rec.PKG) fill.package = rec.PKG;
        if (!t.serviceType && rec.S_TYPE) fill.serviceType = rec.S_TYPE;
        if (!t.lea && rec.LEA) fill.lea = rec.LEA;
        if (!t.woroTaskName && rec.CON_WORO_TASK_NAME) fill.woroTaskName = rec.CON_WORO_TASK_NAME;
        if (!t.woroSeit && rec.CON_WORO_SEIT) fill.woroSeit = rec.CON_WORO_SEIT;
        if (!t.ftthInstSeit && rec.FTTH_INST_SIET) fill.ftthInstSeit = rec.FTTH_INST_SIET;
        if (!t.ftthWifi && rec.FTTH_WIFI) fill.ftthWifi = rec.FTTH_WIFI;
        if (!t.iptv && rec.IPTV && String(rec.IPTV).trim().length > 5) fill.iptv = rec.IPTV;
        if (!t.receivedDate && cd) fill.receivedDate = cd;
        if (!t.statusDate && cd) fill.statusDate = cd;
        if (Object.keys(fill).length === 0) { console.log(`  ${t.soNum}: nothing to fill`); continue; }
        await prisma.serviceOrder.update({ where: { id: t.id }, data: fill });
        filled++;
        console.log(`  filled ${t.soNum}: ${Object.keys(fill).join(', ')}`);
        if (fill.orderType) console.log(`    orderType = ${fill.orderType} | package = ${fill.package ?? '(kept)'}`);
    }
    console.log(`Filled: ${filled}, no portal record: ${unmatched.join(', ') || 'none'}`);
    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
