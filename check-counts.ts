import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkDuplicates() {
    const duplicates = await prisma.$queryRaw`
        SELECT "soNum", COUNT(*) 
        FROM "ServiceOrder" 
        WHERE "sltsStatus" = 'COMPLETED'
        GROUP BY "soNum" 
        HAVING COUNT(*) > 1
    `;
    console.log('Duplicates Found:', duplicates);

    const statsCount = await prisma.serviceOrder.count({
        where: {
            sltsStatus: 'COMPLETED',
            createdAt: { gte: new Date('2026-01-01') }
        }
    });
    console.log('Total Completed (Created in 2026):', statsCount);

    const completedInJanCount = await prisma.serviceOrder.count({
        where: {
            sltsStatus: 'COMPLETED',
            completedDate: {
                gte: new Date('2026-01-01'),
                lte: new Date('2026-01-31T23:59:59')
            }
        }
    });
    console.log('Total Completed (Date in January):', completedInJanCount);

    process.exit(0);
}

checkDuplicates();
