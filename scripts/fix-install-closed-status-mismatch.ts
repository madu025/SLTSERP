import { primaryClient } from '../src/lib/prisma';

async function main() {
    console.log('=== Fix Install-Closed Status Mismatch ===\n');

    // Find SODs where sltsStatus=INSTALL_CLOSED but status is DISAPPEARED or other wrong value
    const mismatched = await primaryClient.serviceOrder.findMany({
        where: {
            sltsStatus: 'INSTALL_CLOSED',
            status: { not: 'INSTALL_CLOSED' }
        },
        select: {
            id: true,
            status: true,
            sltsStatus: true
        }
    });

    console.log(`Found ${mismatched.length} SODs with sltsStatus=INSTALL_CLOSED but status!=INSTALL_CLOSED\n`);

    if (mismatched.length === 0) {
        console.log('No mismatches found. Database is clean.');
        return;
    }

    // Show sample
    console.log('Sample mismatched SODs:');
    mismatched.slice(0, 10).forEach(s => {
        console.log(`  ${s.id} | status: ${s.status} | sltsStatus: ${s.sltsStatus}`);
    });

    if (process.argv.includes('--apply')) {
        console.log('\n--- APPLYING FIX ---');
        
        const result = await primaryClient.serviceOrder.updateMany({
            where: {
                sltsStatus: 'INSTALL_CLOSED',
                status: { not: 'INSTALL_CLOSED' }
            },
            data: {
                status: 'INSTALL_CLOSED'
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
