import { PrismaClient } from '@prisma/client';
import { startOfMonth, endOfMonth } from 'date-fns';

const prisma = new PrismaClient();

async function main() {
    const start = startOfMonth(new Date('2026-01-23'));
    const end = endOfMonth(new Date('2026-01-23'));

    const rows: any = await prisma.$queryRaw`
    SELECT 
      TO_CHAR("statusDate", 'YYYY-MM-DD') as date,
      COUNT(*)::int as count
    FROM "ServiceOrder"
    WHERE "sltsStatus" = 'COMPLETED'
      AND "statusDate" >= ${start}
      AND "statusDate" <= ${end}
    GROUP BY 1
    ORDER BY 1;
  `;

    console.log('--- DAILY COMPLETED BREAKDOWN (JAN 2026) ---');
    let totalAcrossDays = 0;
    rows.forEach((r: any) => {
        console.log(`${r.date}: ${r.count}`);
        totalAcrossDays += r.count;
    });
    console.log('Total across days:', totalAcrossDays);

    const totalExact = await prisma.serviceOrder.count({
        where: {
            sltsStatus: 'COMPLETED',
            statusDate: { gte: start, lte: end }
        }
    });
    console.log('Total Exact Prisma Count:', totalExact);
}

main().catch(console.error).finally(() => prisma.$disconnect());
