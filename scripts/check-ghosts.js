const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkGhosts() {
    const orders = await prisma.serviceOrder.findMany({
        where: {
            completedDate: {
                gte: new Date('2026-01-24T00:00:00Z'),
                lte: new Date('2026-01-24T23:59:59Z')
            }
        },
        include: { opmc: true }
    });

    const ghosts = orders.filter(o => o.rtom !== o.opmc.rtom);
    console.log(`Found ${ghosts.length} orders where order.rtom !== opmc.rtom`);
    if (ghosts.length > 0) {
        console.log('Examples:');
        ghosts.slice(0, 5).forEach(g => {
            console.log(`SO: ${g.soNum} | Order.rtom: ${g.rtom} | OPMC.rtom: ${g.opmc.rtom}`);
        });
    }
}

checkGhosts().finally(() => prisma.$disconnect());
