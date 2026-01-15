const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkOverlap() {
    const cached = await prisma.sLTPATStatus.findMany({ take: 10, select: { soNum: true } });
    const soNums = cached.map(c => c.soNum);

    console.log('Sample SO Numbers in Cache:', soNums);

    const existing = await prisma.serviceOrder.findMany({
        where: { soNum: { in: soNums } },
        select: { soNum: true, sltsStatus: true, hoPatStatus: true }
    });

    console.log('\nMatching ServiceOrders in our system:', existing.length);
    if (existing.length > 0) {
        console.table(existing);
    } else {
        console.log('None of these SO numbers exist in our ServiceOrder table yet.');
    }

    await prisma.$disconnect();
}
checkOverlap();
