import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- SLTS_STATUS = COMPLETED BREAKDOWN BY ACTUAL SLT STATUS ---');
    const breakdown = await prisma.$queryRaw`
    SELECT 
      status as "sltStatus",
      COUNT(*)::int as count
    FROM "ServiceOrder"
    WHERE "sltsStatus" = 'COMPLETED'
    GROUP BY 1
    ORDER BY 2 DESC;
  `;
    console.log(JSON.stringify(breakdown, null, 2));

    console.log('\n--- TOTAL COUNT IF WE ONLY USED INSTALL_CLOSED ---');
    const strictCount = await prisma.serviceOrder.count({
        where: {
            status: 'INSTALL_CLOSED',
            sltsStatus: 'COMPLETED'
        }
    });
    console.log('Strict Count:', strictCount);
}

main().catch(console.error).finally(() => prisma.$disconnect());
