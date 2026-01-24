const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkHK() {
    const start = new Date('2026-01-24T00:00:00Z');
    const end = new Date('2026-01-24T23:59:59Z');

    const orders = await prisma.serviceOrder.findMany({
        where: {
            rtom: 'R-HK',
            OR: [
                { completedDate: { gte: start, lte: end } }
            ]
        },
        select: { soNum: true, orderType: true, completedDate: true, sltsStatus: true }
    });

    console.log('R-HK Completions on 2026-01-24:');
    orders.forEach(o => {
        console.log(`${o.soNum} | Type: ${o.orderType} | Status: ${o.sltsStatus} | Date: ${o.completedDate}`);
    });
}

checkHK().catch(console.error).finally(() => prisma.$disconnect());
