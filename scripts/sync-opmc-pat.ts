import { prisma } from '../src/lib/prisma';
import { SODSyncService } from '../src/services/service-order/sod.sync.service';

async function main() {
    console.log('====================================================');
    console.log('🚀 Starting OPMC PAT Status Sync (Per-RTOM PAT Results)');
    console.log('====================================================\n');

    const opmcs = await prisma.oPMC.findMany({
        select: { id: true, name: true, rtom: true },
        orderBy: { rtom: 'asc' }
    });

    console.log(`Found ${opmcs.length} OPMCs to sync PAT status for.\n`);

    let totalFetched = 0;
    let totalUpdated = 0;

    for (let i = 0; i < opmcs.length; i++) {
        const opmc = opmcs[i];
        console.log(`[${i + 1}/${opmcs.length}] 🔍 Syncing PAT Results for ${opmc.name} (${opmc.rtom})...`);

        try {
            const res = await SODSyncService.syncPatResults(opmc.id, opmc.rtom);
            console.log(`   ✅ ${opmc.rtom}: Fetched ${res.total} PAT items, Updated ${res.updated} Service Orders.`);
            totalFetched += res.total;
            totalUpdated += res.updated;
        } catch (err) {
            console.error(`   ❌ Failed PAT sync for ${opmc.rtom}:`, err);
        }
    }

    console.log('\n====================================================');
    console.log('🎉 OPMC PAT Status Sync Finished Successfully!');
    console.log(`   Total OPMC PAT Items Fetched: ${totalFetched}`);
    console.log(`   Total Service Orders Updated: ${totalUpdated}`);
    console.log('====================================================');

    process.exit(0);
}

main().catch((err) => {
    console.error('Fatal OPMC PAT sync error:', err);
    process.exit(1);
});
