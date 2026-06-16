
import { PrismaClient } from '@prisma/client';
import { sltApiService } from '../src/services/slt-api.service';
import { format } from 'date-fns';

const prisma = new PrismaClient();

async function repair() {
    console.log('Starting Date Repair...');
    const opmcs = await prisma.oPMC.findMany();

    // Range covers the historical sync period
    const startDate = '2026-01-01';
    const endDate = format(new Date(), 'yyyy-MM-dd');

    let totalFixed = 0;

    for (const opmc of opmcs) {
        console.log(`Fetching SLT Data for ${opmc.name} (${opmc.rtom})...`);
        try {
            const sltData = await sltApiService.fetchCompletedSODs(opmc.rtom, startDate, endDate);
            console.log(`Found ${sltData.length} records from SLT.`);

            // Create Map for fast lookup: SO_NUM -> CON_STATUS_DATE
            const sltMap = new Map<string, string>();
            sltData.forEach(d => sltMap.set(d.SO_NUM, d.CON_STATUS_DATE));

            // Find broken DB records for this OPMC (NULL completedDate)
            const brokenSODs = await prisma.serviceOrder.findMany({
                where: {
                    opmcId: opmc.id,
                    sltsStatus: 'COMPLETED',
                    completedDate: null
                },
                select: { id: true, soNum: true }
            });

            console.log(`Found ${brokenSODs.length} broken records in DB for ${opmc.rtom}. Fixing...`);

            let fixedCount = 0;
            for (const sod of brokenSODs) {
                const dateStr = sltMap.get(sod.soNum);
                // If found in SLT map, update. If not, fallback to today (since it IS completed)
                const parsedDate = dateStr ? sltApiService.parseStatusDate(dateStr) : null;
                const finalDate = parsedDate || new Date();

                await prisma.serviceOrder.update({
                    where: { id: sod.id },
                    data: {
                        completedDate: finalDate,
                        statusDate: finalDate
                    }
                });
                fixedCount++;
                totalFixed++;
            }
            console.log(` -> Fixed ${fixedCount} records for ${opmc.rtom}`);

        } catch (e) {
            console.error(`Error processing ${opmc.rtom}:`, e);
        }
    }
    console.log(`\n=== Repair Complete ===\nTotal Fixed: ${totalFixed} records.`);
}

repair()
    .then(async () => {
        await prisma.$disconnect();
    })
    .catch(async (e) => {
        console.error(e);
        await prisma.$disconnect();
        process.exit(1);
    });
