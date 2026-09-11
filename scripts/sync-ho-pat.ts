import { SODSyncService } from '../src/services/service-order/sod.sync.service';

async function main() {
    console.log('====================================================');
    console.log('🚀 Starting HO PAT Status Sync (Approved & Rejected)');
    console.log('====================================================\n');

    console.log('1️⃣ Syncing HO Approved PAT results...');
    const approvedRes = await SODSyncService.syncHoApprovedResults();
    console.log(`   ✅ HO Approved Sync Finished: Cached=${approvedRes.totalCached}, Updated=${approvedRes.totalUpdated}`);

    console.log('\n2️⃣ Syncing HO Rejected PAT results...');
    const rejectedRes = await SODSyncService.syncHoRejectedResults();
    console.log(`   ✅ HO Rejected Sync Finished: Cached=${rejectedRes.totalCached}, Updated=${rejectedRes.totalUpdated}`);

    console.log('\n====================================================');
    console.log('🎉 HO PAT Sync Completed Successfully!');
    console.log(`   Total HO Approved Updated: ${approvedRes.totalUpdated}`);
    console.log(`   Total HO Rejected Updated: ${rejectedRes.totalUpdated}`);
    console.log('====================================================');

    process.exit(0);
}

main().catch((err) => {
    console.error('Fatal HO PAT sync error:', err);
    process.exit(1);
});
