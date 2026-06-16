
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('--- Recent ServiceOrder Updates ---');
    const recentSOs = await prisma.serviceOrder.findMany({
        orderBy: { updatedAt: 'desc' },
        take: 5,
        select: {
            soNum: true,
            status: true,
            sltsStatus: true,
            updatedAt: true,
            comments: true
        }
    });

    recentSOs.forEach(so => {
        console.log(`SO: ${so.soNum}, Status: ${so.status}, SLTS: ${so.sltsStatus}, Updated: ${so.updatedAt}, Comment: ${so.comments}`);
    });

    await prisma.$disconnect();
}

main().catch(console.error);
