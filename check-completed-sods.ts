import { prisma } from './src/lib/prisma';

async function checkCompletedSODs() {
    const testSoNums = [
        'HK202512190077309',
        'HK202601050027472',
        'HK202601120008804',
        'HK202601100082861',
        'KPT202601140077090'
    ];

    console.log('Checking for completed SODs in database...\n');

    const sods = await prisma.serviceOrder.findMany({
        where: {
            soNum: { in: testSoNums },
            sltsStatus: 'COMPLETED'
        },
        select: {
            soNum: true,
            status: true,
            sltsStatus: true,
            completedDate: true,
            createdAt: true
        },
        orderBy: { soNum: 'asc' }
    });

    console.log(`Found ${sods.length} completed SODs in database:`);
    sods.forEach(sod => {
        console.log(`  - ${sod.soNum}: status=${sod.status}, completedDate=${sod.completedDate}`);
    });

    // Check for duplicates
    console.log('\n\nChecking for ALL records (including non-completed):');
    const allRecords = await prisma.serviceOrder.findMany({
        where: { soNum: { in: testSoNums } },
        select: {
            soNum: true,
            status: true,
            sltsStatus: true,
            completedDate: true
        },
        orderBy: { soNum: 'asc' }
    });

    console.log(`Found ${allRecords.length} total records:`);
    allRecords.forEach(sod => {
        console.log(`  - ${sod.soNum}: status=${sod.status}, sltsStatus=${sod.sltsStatus}, completedDate=${sod.completedDate}`);
    });
}

checkCompletedSODs()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
