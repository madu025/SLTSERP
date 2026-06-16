import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const years = await prisma.$queryRaw`
    SELECT 
      EXTRACT(YEAR FROM "statusDate") as year,
      "sltsStatus",
      COUNT(*)::int as count
    FROM "ServiceOrder"
    WHERE "sltsStatus" IN ('COMPLETED', 'RETURN')
    GROUP BY 1, 2
    ORDER BY 1, 2;
  `;
  console.log('--- COMPLETED/RETURN BY YEAR ---');
  console.log(JSON.stringify(years, null, 2));

  const receivedYears = await prisma.$queryRaw`
    SELECT 
      EXTRACT(YEAR FROM "receivedDate") as year,
      COUNT(*)::int as count
    FROM "ServiceOrder"
    GROUP BY 1
    ORDER BY 1;
  `;
  console.log('\n--- RECEIVED BY YEAR ---');
  console.log(JSON.stringify(receivedYears, null, 2));

  const total = await prisma.serviceOrder.count();
  console.log('\nTotal Service Orders in DB:', total);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
