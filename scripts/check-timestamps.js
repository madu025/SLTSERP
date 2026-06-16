const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkHK() {
    const orders = await prisma.serviceOrder.findMany({
        where: { rtom: 'R-HK', sltsStatus: 'COMPLETED' },
        select: { soNum: true, completedDate: true, createdAt: true, updatedAt: true, status: true }
    });
    console.log(orders);
}

checkHK().finally(() => prisma.$disconnect());
