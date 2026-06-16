const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkContent() {
    const stats = await prisma.dashboardStat.findMany({
        take: 5
    });
    console.log(JSON.stringify(stats, null, 2));

    const totalPending = await prisma.dashboardStat.aggregate({
        _sum: {
            pending: true,
            completed: true
        }
    });
    console.log('Total Pending (from Stats):', totalPending._sum.pending);
    console.log('Total Completed (from Stats):', totalPending._sum.completed);
}

checkContent()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
