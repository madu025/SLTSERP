import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- COMPLETED SODS BY YEAR ---');
    const years = await prisma.$queryRaw`
    SELECT 
      EXTRACT(YEAR FROM "statusDate") as year,
      COUNT(*)::int as count
    FROM "ServiceOrder"
    WHERE "sltsStatus" = 'COMPLETED'
    GROUP BY 1
    ORDER BY 1;
  `;
    console.log(JSON.stringify(years, null, 2));

    console.log('\n--- COMPLETED SODS IN 2026 BY MONTH ---');
    const months = await prisma.$queryRaw`
    SELECT 
      EXTRACT(MONTH FROM "statusDate") as month,
      COUNT(*)::int as count
    FROM "ServiceOrder"
    WHERE "sltsStatus" = 'COMPLETED'
      AND "statusDate" >= '2026-01-01'
      AND "statusDate" < '2027-01-01'
    GROUP BY 1
    ORDER BY 1;
  `;
    console.log(JSON.stringify(months, null, 2));

    console.log('\n--- SAMPLE 2026 COMPLETED SODS ---');
    const samples = await prisma.serviceOrder.findMany({
        where: {
            sltsStatus: 'COMPLETED',
            statusDate: {
                gte: new Date('2026-01-01'),
                lt: new Date('2027-01-01'),
            },
        },
        take: 5,
        select: {
            sodNo: true,
            receivedDate: true,
            statusDate: true,
            sltsStatus: true,
        }
    });
    console.log(JSON.stringify(samples, null, 2));
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
