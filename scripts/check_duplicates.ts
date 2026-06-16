import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- DUPLICATE SO_NUM CHECK ---');

    const duplicates = await prisma.$queryRaw`
    SELECT "soNum", COUNT(*) 
    FROM "ServiceOrder" 
    GROUP BY "soNum" 
    HAVING COUNT(*) > 1
  `;

    console.log('Duplicate counts:', duplicates);

    const totalCount = await prisma.serviceOrder.count();
    console.log('Total ServiceOrders in DB:', totalCount);

    // Check counts by year to see where the 13k is coming from
    const countsByYear = await prisma.$queryRaw`
    SELECT EXTRACT(YEAR FROM "receivedDate") as year, COUNT(*)
    FROM "ServiceOrder"
    GROUP BY year
    ORDER BY year DESC
  `;
    console.log('Counts by Year (receivedDate):', countsByYear);

    // Check current month specifically
    const jan2026Count = await prisma.serviceOrder.count({
        where: {
            receivedDate: {
                gte: new Date('2026-01-01T00:00:00Z'),
                lt: new Date('2026-02-01T00:00:00Z')
            }
        }
    });
    console.log('Jan 2026 Received Count (Strict):', jan2026Count);
}

main().catch(console.error).finally(() => prisma.$disconnect());
