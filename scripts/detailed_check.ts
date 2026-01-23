import { PrismaClient } from '@prisma/client';
import { format, startOfMonth, endOfMonth } from 'date-fns';

const prisma = new PrismaClient();

async function main() {
    const start = startOfMonth(new Date('2026-01-23'));
    const end = endOfMonth(new Date('2026-01-23'));

    console.log(`--- DAILY COMPLETED BREAKDOWN (JAN 2026) ---`);
    const dailyCompleted = await prisma.$queryRaw`
    SELECT 
      DATE("statusDate") as date,
      COUNT(*)::int as count
    FROM "ServiceOrder"
    WHERE "sltsStatus" = 'COMPLETED'
      AND "statusDate" >= ${start}
      AND "statusDate" <= ${end}
    GROUP BY 1
    ORDER BY 1;
  `;
    console.log(JSON.stringify(dailyCompleted, null, 2));

    console.log(`\n--- RECENTLY COMPLETED EXAMPLES ---`);
    const samples = await prisma.serviceOrder.findMany({
        where: {
            sltsStatus: 'COMPLETED',
            statusDate: { gte: start, lte: end }
        },
        orderBy: { statusDate: 'desc' },
        take: 10,
        select: {
            sodNo: true,
            statusDate: true,
            receivedDate: true,
            rtom: true
        }
    });
    console.log(JSON.stringify(samples, null, 2));

    const totalCompleted = await prisma.serviceOrder.count({
        where: {
            sltsStatus: 'COMPLETED',
            statusDate: { gte: start, lte: end }
        }
    });
    console.log(`\nTOTAL JAN 2026 COMPLETED: ${totalCompleted}`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
