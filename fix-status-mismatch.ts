import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function fixCompletedMismatch() {
    console.log('--- STARTING STATUS MISMATCH FIX ---');

    // 1. Find orders that are marked as COMPLETED but their SLT status indicates otherwise
    const nonCompletedStatuses = ['INPROGRESS', 'ASSIGNED', 'PAT_REJECTED', 'PAT_OPMC_REJECTED', 'RETURN_PENDING'];

    const count = await prisma.serviceOrder.count({
        where: {
            sltsStatus: 'COMPLETED',
            status: { in: nonCompletedStatuses }
        }
    });

    console.log(`Found ${count} orders incorrectly marked as COMPLETED.`);

    if (count > 0) {
        const result = await prisma.serviceOrder.updateMany({
            where: {
                sltsStatus: 'COMPLETED',
                status: { in: nonCompletedStatuses }
            },
            data: {
                sltsStatus: 'INPROGRESS',
                completedDate: null
            }
        });
        console.log(`Moved ${result.count} orders back to INPROGRESS (Pending).`);
    }

    // 2. Global Recalculate Stats to sync dashboard
    const { StatsService } = await import('./src/lib/stats.service');
    console.log('Recalculating stats for dashboard...');
    await StatsService.globalRecalculate();
    console.log('Stats recalculated successfully.');

    process.exit(0);
}

fixCompletedMismatch();
