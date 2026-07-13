const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const count = await prisma.sLTPATStatus.count();
    console.log('Total SLTPATStatus count:', count);

    const match = await prisma.sLTPATStatus.findFirst({
        where: { soNum: 'MIA202605150050148' }
    });
    console.log('SLTPATStatus for MIA202605150050148:', match);
}

main().catch(console.error).finally(() => prisma.$disconnect());
