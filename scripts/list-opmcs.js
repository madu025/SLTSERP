const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    const opmcs = await prisma.oPMC.findMany();
    console.log(opmcs.map(o => `${o.rtom} | ${o.name}`));
}
check().finally(() => prisma.$disconnect());
