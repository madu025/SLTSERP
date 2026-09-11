import { prisma } from '../src/lib/prisma';

async function main() {
    console.log('====================================================');
    console.log('🚀 Starting PAT Status Backfill for Completed SODs');
    console.log('====================================================\n');

    console.log('1️⃣ Updating opmcPatStatus & sltsPatStatus for HO PAT Passed SODs...');
    const result1 = await prisma.serviceOrder.updateMany({
        where: {
            sltsStatus: { in: ['COMPLETED', 'INSTALL_CLOSED'] },
            hoPatStatus: 'PAT_PASSED',
            OR: [
                { opmcPatStatus: { not: 'PAT_PASSED' } },
                { opmcPatStatus: null },
                { sltsPatStatus: { not: 'PAT_PASSED' } },
                { sltsPatStatus: null },
                { isInvoicable: false }
            ]
        },
        data: {
            opmcPatStatus: 'PAT_PASSED',
            sltsPatStatus: 'PAT_PASSED',
            isInvoicable: true
        }
    });

    console.log(`   ✅ Updated ${result1.count} Completed SODs to PAT_PASSED & isInvoicable = true.`);

    console.log('\n2️⃣ Updating sltsPatStatus for OPMC PAT Passed SODs...');
    const result2 = await prisma.serviceOrder.updateMany({
        where: {
            sltsStatus: { in: ['COMPLETED', 'INSTALL_CLOSED'] },
            opmcPatStatus: 'PAT_PASSED',
            OR: [
                { sltsPatStatus: { not: 'PAT_PASSED' } },
                { sltsPatStatus: null }
            ]
        },
        data: {
            sltsPatStatus: 'PAT_PASSED'
        }
    });

    console.log(`   ✅ Updated ${result2.count} SODs sltsPatStatus to PAT_PASSED.`);

    console.log('\n====================================================');
    console.log('🎉 Completed SOD PAT Status Backfill Finished!');
    console.log(`   Total Invoicable PAT Passed SODs Updated: ${result1.count}`);
    console.log('====================================================');

    process.exit(0);
}

main().catch((err) => {
    console.error('Fatal backfill error:', err);
    process.exit(1);
});
