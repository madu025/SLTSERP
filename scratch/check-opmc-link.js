const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const ordersWithOpmcId = await prisma.serviceOrder.groupBy({
        by: ['opmcId', 'rtom'],
        _count: { id: true }
    });
    console.log('Grouped by opmcId and rtom:', ordersWithOpmcId);

    const nullOpmcOrders = await prisma.serviceOrder.count({
        where: { opmcId: null }
    });
    console.log('Count of orders with null opmcId:', nullOpmcOrders);
}

main().catch(console.error).finally(() => prisma.$disconnect());
