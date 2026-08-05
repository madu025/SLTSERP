/**
 * Ground-truth check: compare R-AD portal ftthpen statuses vs local DB.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const { sltApiService } = await import('../src/services/slt/slt-api.service');
    const data = await sltApiService.fetchServiceOrders('R-AD');
    const portal = new Map(data.map(d => [d.SO_NUM, (d.CON_STATUS || '').toUpperCase()]));

    const portalCounts: Record<string, number> = {};
    for (const s of portal.values()) portalCounts[s] = (portalCounts[s] || 0) + 1;
    console.log('PORTAL ftthpen R-AD:', JSON.stringify(portalCounts));

    // Local records for portal INSTALL_CLOSED SODs
    const icSoNums = [...portal.entries()].filter(([, s]) => s === 'INSTALL_CLOSED').map(([n]) => n);
    const locals = await prisma.serviceOrder.findMany({
        where: { soNum: { in: icSoNums } },
        select: { soNum: true, sltsStatus: true }
    });
    const localMap = new Map(locals.map(l => [l.soNum, l.sltsStatus]));

    let match = 0, mismatch = 0, missing = 0;
    const mismatches: string[] = [];
    for (const n of icSoNums) {
        const local = localMap.get(n);
        if (!local) { missing++; continue; }
        if (local === 'INSTALL_CLOSED') match++;
        else { mismatch++; if (mismatches.length < 8) mismatches.push(`${n}: DB=${local}`); }
    }
    console.log(`Portal INSTALL_CLOSED=${icSoNums.length} | DB match=${match} mismatch=${mismatch} missing=${missing}`);
    if (mismatches.length) console.log('Sample mismatches:', mismatches.join(', '));

    await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
