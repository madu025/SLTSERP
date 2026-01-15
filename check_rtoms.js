const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkRtoms() {
    const opmcs = await prisma.oPMC.findMany({ select: { rtom: true } });
    console.log('RTOMs in OPMC table:', opmcs.map(o => o.rtom));
    await prisma.$disconnect();
}
checkRtoms();
