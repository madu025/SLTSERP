import { prisma } from '../src/lib/prisma';

async function checkTodaySync() {
    const todayStart = new Date('2026-07-25T00:00:00.000Z');

    const createdToday = await prisma.serviceOrder.count({
        where: { createdAt: { gte: todayStart } }
    });

    const updatedToday = await prisma.serviceOrder.count({
        where: { updatedAt: { gte: todayStart } }
    });

    const recentOrders = await prisma.serviceOrder.findMany({
        take: 10,
        orderBy: { updatedAt: 'desc' },
        select: {
            soNum: true,
            status: true,
            sltsStatus: true,
            createdAt: true,
            updatedAt: true
        }
    });

    console.log(`ServiceOrders created today (since ${todayStart.toISOString()}): ${createdToday}`);
    console.log(`ServiceOrders updated today: ${updatedToday}`);
    console.log("\nLatest 10 updated ServiceOrders:");
    console.table(recentOrders.map(o => ({
        soNum: o.soNum,
        status: o.status,
        sltsStatus: o.sltsStatus,
        createdAt: o.createdAt.toISOString(),
        updatedAt: o.updatedAt.toISOString()
    })));
}

checkTodaySync();
