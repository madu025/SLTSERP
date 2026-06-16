const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { startOfDay, endOfDay } = require('date-fns');

async function checkWiredOnly() {
    const selectedDate = new Date('2026-01-24');
    const startDate = startOfDay(selectedDate);
    const endDate = endOfDay(selectedDate);

    console.log('--- Checking Wired Only Counts for 2026-01-24 ---');

    // 1. Orders with wiredOnly field = true AND updated today
    const fieldWired = await prisma.serviceOrder.count({
        where: {
            wiredOnly: true,
            updatedAt: { gte: startDate, lte: endDate }
        }
    });

    // 2. Orders that reached PROV_CLOSED status today
    const historyWired = await prisma.serviceOrderStatusHistory.count({
        where: {
            status: 'PROV_CLOSED',
            statusDate: { gte: startDate, lte: endDate }
        }
    });

    // 3. Current SLTS Status = PROV_CLOSED
    const currentStatusWired = await prisma.serviceOrder.count({
        where: {
            status: 'PROV_CLOSED',
            statusDate: { gte: startDate, lte: endDate }
        }
    });

    console.log(`\nOrders with wiredOnly field = TRUE (updated today): ${fieldWired}`);
    console.log(`Orders reaching PROV_CLOSED status today (History): ${historyWired}`);
    console.log(`Orders currently in PROV_CLOSED status (Today): ${currentStatusWired}`);

    // Break down by RTOM for PROV_CLOSED
    const rtomBreakdown = await prisma.serviceOrder.groupBy({
        by: ['rtom'],
        where: {
            status: 'PROV_CLOSED',
            statusDate: { gte: startDate, lte: endDate }
        },
        _count: { id: true }
    });

    console.log('\n[PROV_CLOSED] Breakdown by RTOM:');
    rtomBreakdown.forEach(r => console.log(`${r.rtom}: ${r._count.id}`));
}

checkWiredOnly().catch(console.error).finally(() => prisma.$disconnect());
