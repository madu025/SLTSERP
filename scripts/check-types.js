const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkHK() {
    const orders = await prisma.serviceOrder.findMany({
        where: { rtom: 'R-HK' },
        take: 10
    });
    console.log(orders.map(o => ({ soNum: o.soNum, orderType: o.orderType })));
}

checkHK().finally(() => prisma.$disconnect());
