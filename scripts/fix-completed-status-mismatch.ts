import { primaryClient } from '../src/lib/prisma';

async function main() {
    console.log('=== Fix Completed SODs with Stale Status ===\n');

    // Find SODs with sltsStatus=COMPLETED but status=PENDING
    const mismatched = await primaryClient.serviceOrder.findMany({
        where: {
            sltsStatus: 'COMPLETED',
            status: 'PENDING'
        },
        select: {
            soNum: true,
            status: true,
            sltsStatus: true
        }
    });

    console.log(`Found ${mismatched.length} SODs with sltsStatus=COMPLETED but status=PENDING\n`);

    if (mismatched.length === 0) {
        console.log('No mismatches found. Database is clean.');
        return;
    }

    // Show sample
    console.log('Sample mismatched SODs:');
    mismatched.slice(0, 20).forEach(s => {
        console.log(`  ${s.soNum} | status: ${s.status} | sltsStatus: ${s.sltsStatus}`);
    });

    if (process.argv.includes('--apply')) {
        console.log('\n--- APPLYING FIX ---');
        
        const result = await primaryClient.serviceOrder.updateMany({
            where: {
                sltsStatus: 'COMPLETED',
                status: 'PENDING'
            },
            data: {
                status: 'COMPLETED'
            }
        });

        console.log(`\nFixed ${result.count} SODs`);
    } else {
        console.log('\n--- DRY RUN ---');
        console.log('Run with --apply flag to fix these records');
    }
}

main()
    .catch(console.error)
    .finally(() => primaryClient.$disconnect());
