const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const counts = await prisma.serviceOrder.groupBy({
        by: ['sltsStatus', 'status'],
        where: { rtom: 'R-AD' },
        _count: { id: true }
    });
    console.log('R-AD Status Counts:', counts);

    const dates = await prisma.serviceOrder.aggregate({
        where: { rtom: 'R-AD' },
        _min: {
            receivedDate: true,
            statusDate: true,
            completedDate: true
        },
        _max: {
            receivedDate: true,
            statusDate: true,
            completedDate: true
        }
    });
    console.log('R-AD Date Ranges:', dates);
}

main().catch(console.error).finally(() => prisma.$disconnect());
