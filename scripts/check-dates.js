const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDates() {
    const so = await prisma.serviceOrder.findFirst();
    console.log('Sample Service Order Date:', so?.createdAt);

    const now = new Date();
    console.log('Current Server Time:', now);
}

checkDates()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
