const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function parseDateFromSoNum(soNum) {
    const match = soNum.match(/(202[3-6])(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])/);
    if (match) {
        const year = parseInt(match[1]);
        const month = parseInt(match[2]) - 1; // 0-indexed
        const day = parseInt(match[3]);
        // Set to noon UTC to avoid timezone shifts
        return new Date(Date.UTC(year, month, day, 12, 0, 0));
    }
    return null;
}

async function main() {
    console.log('Querying for auto-stubbed service orders...');
    const records = await prisma.serviceOrder.findMany({
        where: {
            comments: 'Auto-stubbed from BOM sheet backlog sync'
        },
        select: {
            id: true,
            soNum: true,
            rtom: true,
            opmcId: true,
            receivedDate: true
        }
    });

    console.log(`Found ${records.length} auto-stubbed records in the database.`);

    let updatedCount = 0;
    const affectedOpmcIds = new Set();

    for (const record of records) {
        const parsedDate = parseDateFromSoNum(record.soNum);
        if (!parsedDate) {
            console.log(` > Could not parse date from: ${record.soNum}`);
            continue;
        }

        // We only update if the dates are currently set to the import timestamp (July 11) or null
        // (to avoid overwrite if they were somehow edited before)
        await prisma.serviceOrder.update({
            where: { id: record.id },
            data: {
                receivedDate: parsedDate,
                statusDate: parsedDate,
                completedDate: parsedDate
            }
        });
        affectedOpmcIds.add(record.opmcId);
        updatedCount++;
    }

    console.log(`Successfully updated dates for ${updatedCount} records.`);

    // Recalculate stats for all affected OPMCs
    console.log('Recalculating dashboard stats for affected OPMCs...');
    const currentYear = new Date().getFullYear();
    const currentYearStart = new Date(`${currentYear}-01-01T00:00:00Z`);
    const nextYearStart = new Date(`${currentYear + 1}-01-01T00:00:00Z`);

    for (const opmcId of affectedOpmcIds) {
        const opmc = await prisma.oPMC.findUnique({ where: { id: opmcId }, select: { rtom: true } });
        if (!opmc) continue;

        console.log(` > Recalculating stats for OPMC: ${opmc.rtom} (${opmc.id})...`);
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

        console.log(`   - pending=${pending}, completed=${completed}, returned=${returned}`);

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

    console.log('Global recalculation of affected OPMC stats completed!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
