const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Fetching OPMCs from database...');
    const opmcs = await prisma.oPMC.findMany({ select: { id: true, rtom: true } });
    console.log(`Found ${opmcs.length} OPMCs in database.`);

    const currentYear = new Date().getFullYear();
    const currentYearStart = new Date(`${currentYear}-01-01T00:00:00Z`);
    const nextYearStart = new Date(`${currentYear + 1}-01-01T00:00:00Z`);

    for (const opmc of opmcs) {
        console.log(`Recalculating stats for OPMC: ${opmc.rtom} (${opmc.id})...`);
        const [
            pending,
            completed,
            returned,
            patPassed,
            patRejected,
            sltsPatRejected
        ] = await Promise.all([
            prisma.serviceOrder.count({ where: { opmcId: opmc.id, sltsStatus: 'INPROGRESS', OR: [{ receivedDate: { gte: currentYearStart, lt: nextYearStart } }, { statusDate: { gte: currentYearStart, lt: nextYearStart } }] } }),
            prisma.serviceOrder.count({ where: { opmcId: opmc.id, sltsStatus: 'COMPLETED', OR: [{ statusDate: { gte: currentYearStart, lt: nextYearStart } }, { completedDate: { gte: currentYearStart, lt: nextYearStart } }] } }),
            prisma.serviceOrder.count({ where: { opmcId: opmc.id, sltsStatus: 'RETURN', OR: [{ statusDate: { gte: currentYearStart, lt: nextYearStart } }, { completedDate: { gte: currentYearStart, lt: nextYearStart } }] } }),
            prisma.serviceOrder.count({ where: { opmcId: opmc.id, patStatus: 'PASS', statusDate: { gte: currentYearStart, lt: nextYearStart } } }),
            prisma.serviceOrder.count({ where: { opmcId: opmc.id, patStatus: 'REJECTED', statusDate: { gte: currentYearStart, lt: nextYearStart } } }),
            prisma.serviceOrder.count({ where: { opmcId: opmc.id, sltsPatStatus: 'REJECTED', statusDate: { gte: currentYearStart, lt: nextYearStart } } }),
        ]);

        console.log(` > stats: pending=${pending}, completed=${completed}, returned=${returned}, patPassed=${patPassed}, patRejected=${patRejected}, sltsPatRejected=${sltsPatRejected}`);

        await prisma.dashboardStat.upsert({
            where: { opmcId: opmc.id },
            create: {
                opmcId: opmc.id,
                rtom: opmc.rtom,
                pending, completed, returned, patPassed, patRejected, sltsPatRejected
            },
            update: {
                pending, completed, returned, patPassed, patRejected, sltsPatRejected
            }
        });
    }

    console.log('Global recalculation of dashboardStat completed successfully!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
