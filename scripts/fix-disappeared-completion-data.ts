/**
 * Fix existing DISAPPEARED SODs that have stale completion data
 * Run: npx tsx scripts/fix-disappeared-completion-data.ts [--apply]
 * Without --apply it runs in DRY-RUN mode (no writes).
 */
import 'dotenv/config';
import { primaryClient } from '../src/lib/prisma';

const APPLY = process.argv.includes('--apply');

async function main() {
    console.log('=== Fixing DISAPPEARED SODs with stale completion data ===\n');

    // Find all DISAPPEARED SODs that have completedDate, revenueAmount, or contractorAmount set
    const disappearedSods = await primaryClient.serviceOrder.findMany({
        where: {
            sltsStatus: 'DISAPPEARED',
            OR: [
                { completedDate: { not: null } },
                { revenueAmount: { not: null } },
                { contractorAmount: { not: null } },
                { contractorId: { not: null } },
                { teamId: { not: null } }
            ]
        },
        select: {
            id: true,
            soNum: true,
            completedDate: true,
            revenueAmount: true,
            contractorAmount: true,
            contractorId: true,
            teamId: true
        }
    });

    console.log(`Found ${disappearedSods.length} DISAPPEARED SODs with stale data\n`);

    if (disappearedSods.length === 0) {
        console.log('No SODs need fixing. Exiting.');
        return;
    }

    // Show first 10 SODs that need fixing
    console.log('Sample SODs to fix:');
    disappearedSods.slice(0, 10).forEach(sod => {
        console.log(`  ${sod.soNum}: completedDate=${sod.completedDate}, revenue=${sod.revenueAmount}, contractor=${sod.contractorAmount}`);
    });
    if (disappearedSods.length > 10) {
        console.log(`  ... and ${disappearedSods.length - 10} more`);
    }

    console.log('\nFixing...');
    if (!APPLY) {
        console.log('DRY-RUN mode. Add --apply to actually fix the data.\n');
    }

    let fixed = 0;
    let errors = 0;

    for (const sod of disappearedSods) {
        try {
            if (APPLY) {
                await primaryClient.serviceOrder.update({
                    where: { id: sod.id },
                    data: {
                        completedDate: null,
                        revenueAmount: null,
                        contractorAmount: null,
                        contractorId: null,
                        teamId: null
                    }
                });
            } else {
                console.log(`  Would fix: ${sod.soNum}`);
            }
            fixed++;
        } catch (err) {
            errors++;
            console.error(`Error fixing ${sod.soNum}: ${err instanceof Error ? err.message : err}`);
        }
    }

    console.log(`\n=== Summary ===`);
    console.log(`Total: ${disappearedSods.length}`);
    console.log(`Fixed: ${fixed}`);
    console.log(`Errors: ${errors}`);

    // Verify
    const remaining = await primaryClient.serviceOrder.count({
        where: {
            sltsStatus: 'DISAPPEARED',
            OR: [
                { completedDate: { not: null } },
                { revenueAmount: { not: null } },
                { contractorAmount: { not: null } }
            ]
        }
    });

    console.log(`\nRemaining DISAPPEARED SODs with stale data: ${remaining}`);
}

main()
    .catch(console.error)
    .finally(async () => {
        await primaryClient.$disconnect();
    });
