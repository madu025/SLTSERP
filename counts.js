const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function counts() {
    const sodCount = await prisma.serviceOrder.count();
    const patCount = await prisma.sLTPATStatus.count();
    console.log(`ServiceOrder Count: ${sodCount}`);
    console.log(`SLTPATStatus Count: ${patCount}`);

    if (sodCount > 0) {
        const sampleSods = await prisma.serviceOrder.findMany({ take: 5, select: { soNum: true } });
        console.log('Sample SOD SoNums:', sampleSods.map(s => s.soNum));
    }
    await prisma.$disconnect();
}
counts();
