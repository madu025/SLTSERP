const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    const orders = await prisma.serviceOrder.findMany({
        where: {
            sltsStatus: 'COMPLETED',
            completedDate: {
                gte: new Date('2026-01-24T00:00:00Z'),
                lte: new Date('2026-01-24T23:59:59Z')
            }
        },
        select: { soNum: true, rtom: true, opmcId: true }
    });

    const opmcs = await prisma.oPMC.findMany({ select: { id: true, rtom: true } });
    const opmcMap = new Map(opmcs.map(o => [o.id, o.rtom]));

    console.log('Order | Order.rtom | Linked OPMC.rtom');
    orders.forEach(o => {
        console.log(`${o.soNum} | ${o.rtom} | ${opmcMap.get(o.opmcId)}`);
    });
}

check().catch(console.error).finally(() => prisma.$disconnect());
