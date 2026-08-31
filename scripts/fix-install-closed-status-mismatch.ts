import { primaryClient } from '../src/lib/prisma';

// Active/workflow statuses that must advance to INSTALL_CLOSED when the portal
// confirms install closure. DISAPPEARED is intentionally excluded — the
// completed-sod-sync restore flow owns those (33 rows).
const ADVANCABLE_STATUSES = ['PENDING', 'INPROGRESS', 'PROV_CLOSED', 'ASSIGNED', 'ASSIGN', 'OFFLINE'];

async function main() {
    console.log('=== Fix Install-Closed Status Mismatch ===\n');

    const mismatched = await primaryClient.serviceOrder.findMany({
        where: {
            sltsStatus: 'INSTALL_CLOSED',
            status: { in: ADVANCABLE_STATUSES as ('PENDING' | 'INPROGRESS' | 'PROV_CLOSED' | 'ASSIGNED' | 'ASSIGN' | 'OFFLINE')[] }
        },
        select: {
            id: true,
            soNum: true,
            status: true,
            sltsStatus: true,
            completedDate: true,
            statusDate: true
        }
    });

    console.log(`Found ${mismatched.length} SODs with sltsStatus=INSTALL_CLOSED but stale workflow status\n`);

    // Breakdown by current status
    const breakdown: Record<string, number> = {};
    mismatched.forEach(s => { breakdown[s.status] = (breakdown[s.status] || 0) + 1; });
    console.log('Breakdown:', JSON.stringify(breakdown, null, 2));

    if (mismatched.length === 0) {
        console.log('No mismatches found. Database is clean.');
        return;
    }

    console.log('Sample mismatched SODs:');
    mismatched.slice(0, 10).forEach(s => {
        console.log(`  ${s.soNum} | status: ${s.status} | sltsStatus: ${s.sltsStatus}`);
    });

    if (process.argv.includes('--apply')) {
        console.log('\n--- APPLYING FIX ---');

        let fixed = 0;
        let failed = 0;
        // Low concurrency — Supabase pooler exhausts with parallel transactions
        const BATCH = 3;
        for (let i = 0; i < mismatched.length; i += BATCH) {
            const batch = mismatched.slice(i, i + BATCH);
            const results = await Promise.allSettled(batch.map(sod =>
                primaryClient.$transaction(async (tx) => {
                    await tx.serviceOrder.update({
                        where: { id: sod.id },
                        data: { status: 'INSTALL_CLOSED' }
                    });
                    // Audit parity with sync-driven transitions (handlePostUpdate)
                    await tx.serviceOrderStatusHistory.create({
                        data: {
                            serviceOrderId: sod.id,
                            status: 'INSTALL_CLOSED',
                            statusDate: sod.completedDate || sod.statusDate || new Date()
                        }
                    });
                })
            ));
            results.forEach(r => {
                if (r.status === 'fulfilled') fixed++;
                else { failed++; console.error('  failed:', r.reason?.message?.slice(0, 120)); }
            });
            console.log(`  progress: ${Math.min(i + BATCH, mismatched.length)}/${mismatched.length}`);
        }

        console.log(`\nFixed ${fixed} SODs, ${failed} failed`);
    } else {
        console.log('\n--- DRY RUN ---');
        console.log('Run with --apply flag to fix these records');
    }
}

main()
    .catch(console.error)
    .finally(() => primaryClient.$disconnect());
