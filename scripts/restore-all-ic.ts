/**
 * Full restore: Re-sync all OPMCs to restore INSTALL_CLOSED records
 * overridden to COMPLETED by the completed-sod-sync regression.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const opmcs = await prisma.oPMC.findMany({ select: { id: true, rtom: true }, orderBy: { rtom: 'asc' } });
    console.log(`Found ${opmcs.length} OPMCs`);

    const before = await prisma.serviceOrder.groupBy({ by: ['sltsStatus'], _count: true });
    console.log('BEFORE:', JSON.stringify(before.map(b => ({ status: b.sltsStatus, count: b._count }))));

    const { SODSyncService } = await import('../src/services/sod/sod.sync.service');

    let totalCreated = 0, totalUpdated = 0, failed = 0;
    for (let i = 0; i < opmcs.length; i += 3) {
        const batch = opmcs.slice(i, i + 3);
        const results = await Promise.all(batch.map(o =>
            SODSyncService.syncServiceOrders(o.id, o.rtom).catch(e => {
                failed++;
                console.error(`[ERR] ${o.rtom}:`, e instanceof Error ? e.message : e);
                return { created: 0, updated: 0 };
            })
        ));
        results.forEach((r) => { totalCreated += r.created; totalUpdated += r.updated; });
        console.log(`  Progress: ${Math.min(i + 3, opmcs.length)}/${opmcs.length}`);
    }

    console.log(`\nTotal: created=${totalCreated} updated=${totalUpdated} failedOpmcs=${failed}`);

    const after = await prisma.serviceOrder.groupBy({ by: ['sltsStatus'], _count: true });
    console.log('AFTER:', JSON.stringify(after.map(b => ({ status: b.sltsStatus, count: b._count }))));

    const rad = await prisma.serviceOrder.groupBy({ by: ['sltsStatus'], where: { rtom: 'R-AD' }, _count: true });
    console.log('R-AD AFTER:', JSON.stringify(rad.map(b => ({ status: b.sltsStatus, count: b._count }))));

    await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
