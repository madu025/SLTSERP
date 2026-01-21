import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function cleanDuplicates() {
    console.log('--- STARTING DUPLICATE CLEANUP ---');

    // 1. Find all duplicate soNums that are COMPLETED
    const duplicates: any[] = await prisma.$queryRaw`
        SELECT "soNum" FROM "ServiceOrder" 
        WHERE "sltsStatus" = 'COMPLETED'
        GROUP BY "soNum" 
        HAVING COUNT(*) > 1
    `;

    console.log(`Found ${duplicates.length} soNums with duplicates.`);

    let deletedCount = 0;
    for (const d of duplicates) {
        const records = await prisma.serviceOrder.findMany({
            where: { soNum: d.soNum, sltsStatus: 'COMPLETED' },
            orderBy: { createdAt: 'desc' }
        });

        // Keep the newest one, delete others
        const toDeleteIds = records.slice(1).map(r => r.id);
        if (toDeleteIds.length > 0) {
            await prisma.serviceOrder.deleteMany({
                where: { id: { in: toDeleteIds } }
            });
            deletedCount += toDeleteIds.length;
        }
    }

    console.log(`Successfully deleted ${deletedCount} duplicate records.`);

    // 2. Global Recalculate Stats
    const { StatsService } = await import('./src/lib/stats.service');
    console.log('Recalculating stats...');
    await StatsService.globalRecalculate();
    console.log('Stats recalculated.');

    process.exit(0);
}

cleanDuplicates();
