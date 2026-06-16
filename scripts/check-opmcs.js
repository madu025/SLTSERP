const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    const opmcs = await prisma.oPMC.findMany({
        select: { rtom: true, name: true }
    });
    console.log('RTOM List:');
    console.log(opmcs);

    const counts = await prisma.serviceOrder.groupBy({
        by: ['rtom'],
        where: {
            sltsStatus: 'COMPLETED',
            completedDate: {
                gte: new Date('2026-01-24T00:00:00Z'),
                lte: new Date('2026-01-24T23:59:59Z')
            }
        },
        _count: { id: true }
    });
    console.log('\nCompletion Counts by RTOM for 1/24:');
    console.log(counts);
}

check().catch(console.error).finally(() => prisma.$disconnect());
