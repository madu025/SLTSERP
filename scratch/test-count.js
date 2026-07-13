const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const opmcId = 'cmqm1906j000psivognddczvk';
    const currentYear = new Date().getFullYear();
    const currentYearStart = new Date(`${currentYear}-01-01T00:00:00Z`);
    const nextYearStart = new Date(`${currentYear + 1}-01-01T00:00:00Z`);

    console.log('Parameters:', { opmcId, currentYearStart, nextYearStart });

    const totalInOpmc = await prisma.serviceOrder.count({
        where: { opmcId }
    });
    console.log('Total in OPMC:', totalInOpmc);

    const completedInOpmc = await prisma.serviceOrder.count({
        where: { opmcId, sltsStatus: 'COMPLETED' }
    });
    console.log('Completed sltsStatus in OPMC:', completedInOpmc);

    const withDate = await prisma.serviceOrder.count({
        where: {
            opmcId,
            sltsStatus: 'COMPLETED',
            OR: [
                { completedDate: { gte: currentYearStart, lt: nextYearStart } },
                { statusDate: { gte: currentYearStart, lt: nextYearStart } }
            ]
        }
    });
    console.log('Completed with Date Filter in OPMC:', withDate);

    // Let's print one record complete properties
    const one = await prisma.serviceOrder.findFirst({
        where: { opmcId, sltsStatus: 'COMPLETED' }
    });
    console.log('One sample record:', one);
}

main().catch(console.error).finally(() => prisma.$disconnect());
