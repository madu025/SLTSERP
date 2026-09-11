import { CompletedSODSyncService } from '../src/services/service-order/completed-sod-sync.service';

const MONTH_WINDOWS_2026 = [
    { name: 'Jan 2026', start: '2026-01-01', end: '2026-01-31' },
    { name: 'Feb 2026', start: '2026-02-01', end: '2026-02-28' },
    { name: 'Mar 2026', start: '2026-03-01', end: '2026-03-31' },
    { name: 'Apr 2026', start: '2026-04-01', end: '2026-04-30' },
    { name: 'May 2026', start: '2026-05-01', end: '2026-05-31' },
    { name: 'Jun 2026', start: '2026-06-01', end: '2026-06-30' },
    { name: 'Jul 2026', start: '2026-07-01', end: '2026-07-31' },
    { name: 'Aug 2026', start: '2026-08-01', end: '2026-08-31' },
    { name: 'Sep 2026', start: '2026-09-01', end: '2026-09-11' },
];

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
    console.log('====================================================');
    console.log('🚀 Starting 2026 Gentle Batch Sync for Completed SODs');
    console.log('====================================================\n');

    let totalChecked = 0;
    let totalCompleted = 0;
    let totalEnriched = 0;
    let totalBlocked = 0;
    const allErrors: string[] = [];

    for (let i = 0; i < MONTH_WINDOWS_2026.length; i++) {
        const month = MONTH_WINDOWS_2026[i];
        console.log(`[${i + 1}/${MONTH_WINDOWS_2026.length}] 📅 Syncing ${month.name} (${month.start} to ${month.end})...`);

        try {
            const res = await CompletedSODSyncService.syncCompletedSODs(month.start, month.end);
            console.log(`   ✅ ${month.name} Done! Checked: ${res.checked}, Completed/Updated: ${res.completed}, Enriched: ${res.enriched}, Policy Blocked: ${res.blockedByPolicy}`);
            if (res.errors.length > 0) {
                console.log(`   ⚠️ Warnings/Errors: ${res.errors.length}`);
                allErrors.push(...res.errors);
            }

            totalChecked += res.checked;
            totalCompleted += res.completed;
            totalEnriched += res.enriched;
            totalBlocked += res.blockedByPolicy;

        } catch (err) {
            console.error(`   ❌ Failed to sync ${month.name}:`, err);
            allErrors.push(`${month.name} failed: ${(err as Error).message}`);
        }

        // Gentle pause between months to avoid portal or database stress
        if (i < MONTH_WINDOWS_2026.length - 1) {
            console.log('   ⏳ Waiting 1.5s before next month...\n');
            await sleep(1500);
        }
    }

    console.log('\n====================================================');
    console.log('🎉 2026 Completed SOD Sync Finished Successfully!');
    console.log(`   Total Checked: ${totalChecked}`);
    console.log(`   Total Completed/Updated: ${totalCompleted}`);
    console.log(`   Total Enriched: ${totalEnriched}`);
    console.log(`   Total Blocked By Policy: ${totalBlocked}`);
    console.log(`   Total Errors/Warnings: ${allErrors.length}`);
    console.log('====================================================');

    process.exit(0);
}

main().catch((err) => {
    console.error('Fatal batch sync error:', err);
    process.exit(1);
});
