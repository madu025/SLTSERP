const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function recalculate() {
    console.log('🔄 Starting Global Stats Recalculation...');

    const opmcs = await prisma.oPMC.findMany({ select: { id: true, rtom: true } });
    console.log(`Found ${opmcs.length} OPMCs.`);

    const currentYearStart = new Date('2026-01-01T00:00:00Z');
    const nextYearStart = new Date('2027-01-01T00:00:00Z');

    for (const opmc of opmcs) {
        process.stdout.write(`Processing ${opmc.rtom}... `);

        const baseWhere = {
            opmcId: opmc.id,
            createdAt: { gte: currentYearStart, lt: nextYearStart }
        };

        const [
            pending,
            completed,
            returned,
            patPassed,
            patRejected,
            sltsPatRejected
        ] = await Promise.all([
            prisma.serviceOrder.count({ where: { ...baseWhere, sltsStatus: 'INPROGRESS' } }),
            prisma.serviceOrder.count({ where: { ...baseWhere, sltsStatus: 'COMPLETED' } }),
            prisma.serviceOrder.count({ where: { ...baseWhere, sltsStatus: 'RETURN' } }),
            prisma.serviceOrder.count({ where: { ...baseWhere, patStatus: 'PASS' } }),
            prisma.serviceOrder.count({ where: { ...baseWhere, patStatus: 'REJECTED' } }),
            prisma.serviceOrder.count({ where: { ...baseWhere, sltsPatStatus: 'REJECTED' } }),
        ]);

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

        console.log('✅ Done');
    }

    console.log('🎉 Recalculation Complete!');
}

recalculate()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
