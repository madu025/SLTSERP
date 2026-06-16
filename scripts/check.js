const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    const start = new Date('2026-01-24T00:00:00Z');
    const end = new Date('2026-01-24T23:59:59Z');

    const orders = await prisma.serviceOrder.findMany({
        where: {
            rtom: 'R-HK',
            OR: [
                { completedDate: { gte: start, lte: end } },
                { status: { in: ['INSTALL_CLOSED', 'COMPLETED'] }, statusDate: { gte: start, lte: end } }
            ]
        },
        select: { soNum: true, status: true, sltsStatus: true, completedDate: true, statusDate: true }
    });

    console.log('R-HK Orders Completed Today according to DB fields:');
    console.log(orders);
}

check().catch(console.error).finally(() => prisma.$disconnect());
