const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const soNums = [
    'AD202307070014752',
    'AD202307250058387',
    'AD202307290033640',
    'AD202307290033804',
    'AD202307290034054',
    'AD202307290034112',
    'AD202307290034811',
    'MTE202307070014595',
    'MTE202307150027256',
    'NCH202307170055332',
    'PPK202307110084452'
];

function parseDateFromSoNum(soNum) {
    const match = soNum.match(/(202[3-6])(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])/);
    if (match) {
        const year = parseInt(match[1]);
        const month = parseInt(match[2]) - 1; // 0-indexed
        const day = parseInt(match[3]);
        // Set to noon UTC to avoid timezone issues
        return new Date(Date.UTC(year, month, day, 12, 0, 0));
    }
    return null;
}

async function main() {
    console.log('Fixing dates for specified SO numbers...');
    
    let updatedCount = 0;
    for (const soNum of soNums) {
        const parsedDate = parseDateFromSoNum(soNum);
        if (!parsedDate) {
            console.log(`Could not parse date from SO number: ${soNum}`);
            continue;
        }

        const record = await prisma.serviceOrder.findFirst({
            where: { soNum }
        });

        if (record) {
            console.log(`Updating ${soNum} with date: ${parsedDate.toISOString()}`);
            await prisma.serviceOrder.update({
                where: { id: record.id },
                data: {
                    receivedDate: parsedDate,
                    statusDate: parsedDate,
                    completedDate: parsedDate
                }
            });
            updatedCount++;
        } else {
            console.log(`Record not found in DB for: ${soNum}`);
        }
    }

    console.log(`Successfully updated ${updatedCount} records.`);

    // Recalculate dashboard stats for R-AD OPMC to make sure
    const adOpmc = await prisma.oPMC.findFirst({
        where: { rtom: 'R-AD' }
    });

    if (adOpmc) {
        console.log(`Triggering recalculation for OPMC R-AD (${adOpmc.id})...`);
        const currentYear = new Date().getFullYear();
        const currentYearStart = new Date(`${currentYear}-01-01T00:00:00Z`);
        const nextYearStart = new Date(`${currentYear + 1}-01-01T00:00:00Z`);

        const [
            pending,
            completed,
            returned,
            patPassed,
            patRejected,
            sltsPatRejected
        ] = await Promise.all([
            prisma.serviceOrder.count({ where: { opmcId: adOpmc.id, sltsStatus: 'INPROGRESS', OR: [{ receivedDate: { gte: currentYearStart, lt: nextYearStart } }, { statusDate: { gte: currentYearStart, lt: nextYearStart } }] } }),
            prisma.serviceOrder.count({ where: { opmcId: adOpmc.id, sltsStatus: 'COMPLETED', OR: [{ statusDate: { gte: currentYearStart, lt: nextYearStart } }, { completedDate: { gte: currentYearStart, lt: nextYearStart } }] } }),
            prisma.serviceOrder.count({ where: { opmcId: adOpmc.id, sltsStatus: 'RETURN', OR: [{ statusDate: { gte: currentYearStart, lt: nextYearStart } }, { completedDate: { gte: currentYearStart, lt: nextYearStart } }] } }),
            prisma.serviceOrder.count({ where: { opmcId: adOpmc.id, patStatus: 'PASS', statusDate: { gte: currentYearStart, lt: nextYearStart } } }),
            prisma.serviceOrder.count({ where: { opmcId: adOpmc.id, patStatus: 'REJECTED', statusDate: { gte: currentYearStart, lt: nextYearStart } } }),
            prisma.serviceOrder.count({ where: { opmcId: adOpmc.id, sltsPatStatus: 'REJECTED', statusDate: { gte: currentYearStart, lt: nextYearStart } } }),
        ]);

        await prisma.dashboardStat.upsert({
            where: { opmcId: adOpmc.id },
            create: {
                opmcId: adOpmc.id,
                rtom: adOpmc.rtom,
                pending, completed, returned, patPassed, patRejected, sltsPatRejected
            },
            update: {
                pending, completed, returned, patPassed, patRejected, sltsPatRejected
            }
        });
        console.log('Stats recalculated successfully!');
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
