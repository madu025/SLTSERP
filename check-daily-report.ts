import { prisma } from './src/lib/prisma';
import { startOfDay, endOfDay } from 'date-fns';

async function checkDailyReport() {
    // Check for 2026-01-20 (the date in the SLT data)
    const selectedDate = new Date('2026-01-20');
    const startDate = startOfDay(selectedDate);
    const endDate = endOfDay(selectedDate);

    console.log(`Checking Daily Report for: ${selectedDate.toDateString()}`);
    console.log(`Date Range: ${startDate.toISOString()} to ${endDate.toISOString()}\n`);

    // Check completed SODs for R-HK
    const completedSODs = await prisma.serviceOrder.findMany({
        where: {
            rtom: 'R-HK',
            sltsStatus: 'COMPLETED',
            status: 'COMPLETED',  // Only COMPLETED status
            completedDate: {
                gte: startDate,
                lte: endDate
            }
        },
        select: {
            soNum: true,
            status: true,
            sltsStatus: true,
            completedDate: true,
            orderType: true
        },
        orderBy: { soNum: 'asc' }
    });

    console.log(`✅ Found ${completedSODs.length} SODs with status='COMPLETED' completed on ${selectedDate.toDateString()}:`);
    completedSODs.forEach(sod => {
        console.log(`  - ${sod.soNum}: orderType=${sod.orderType}, completedDate=${sod.completedDate}`);
    });

    // Also check for SODs with sltsStatus=COMPLETED but different status
    console.log('\n\n📊 Checking for other completion statuses:');
    const otherStatuses = await prisma.serviceOrder.findMany({
        where: {
            rtom: 'R-HK',
            sltsStatus: 'COMPLETED',
            status: { not: 'COMPLETED' },
            completedDate: {
                gte: startDate,
                lte: endDate
            }
        },
        select: {
            soNum: true,
            status: true,
            completedDate: true
        },
        orderBy: { status: 'asc' }
    });

    console.log(`Found ${otherStatuses.length} SODs with other completion statuses:`);
    const statusGroups = otherStatuses.reduce((acc: any, sod) => {
        acc[sod.status] = (acc[sod.status] || 0) + 1;
        return acc;
    }, {});

    Object.entries(statusGroups).forEach(([status, count]) => {
        console.log(`  - ${status}: ${count} SODs`);
    });
}

checkDailyReport()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
