const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const total = await prisma.serviceOrder.count();
    console.log('Total Service Orders:', total);

    const grouped = await prisma.serviceOrder.groupBy({
        by: ['rtom'],
        _count: { id: true }
    });
    console.log('Grouped by RTOM:', grouped);

    const opmcs = await prisma.oPMC.findMany({
        select: { id: true, name: true, rtom: true }
    });
    console.log('OPMCs in DB:', opmcs);

    const dashboardStats = await prisma.dashboardStat.findMany();
    console.log('Dashboard Stats in DB:', dashboardStats);
}

main().catch(console.error).finally(() => prisma.$disconnect());
