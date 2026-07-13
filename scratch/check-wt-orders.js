const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const wtOrders = await prisma.serviceOrder.findMany({
        where: { rtom: 'R-WT' },
        take: 10,
        select: {
            id: true,
            soNum: true,
            sltsStatus: true,
            status: true,
            receivedDate: true,
            statusDate: true,
            completedDate: true
        }
    });
    console.log('Sample R-WT Orders:', wtOrders);

    const counts = await prisma.serviceOrder.groupBy({
        by: ['sltsStatus', 'status'],
        where: { rtom: 'R-WT' },
        _count: { id: true }
    });
    console.log('R-WT Status Counts:', counts);

    // Let's check date ranges for R-WT
    const dates = await prisma.serviceOrder.aggregate({
        where: { rtom: 'R-WT' },
        _min: {
            receivedDate: true,
            statusDate: true
        },
        _max: {
            receivedDate: true,
            statusDate: true
        }
    });
    console.log('R-WT Date Ranges:', dates);
}

main().catch(console.error).finally(() => prisma.$disconnect());
