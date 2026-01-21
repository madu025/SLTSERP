import { prisma } from './src/lib/prisma';

async function checkDuplicates() {
    const dups: any[] = await prisma.$queryRaw`
        SELECT "soNum", COUNT(*) as count 
        FROM "ServiceOrder" 
        GROUP BY "soNum" 
        HAVING COUNT(*) > 1 
        LIMIT 10
    `;

    console.log('Sample Duplicates (soNum only):', JSON.stringify(dups, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value, 2));

    if (dups.length > 0) {
        const firstSoNum = dups[0].soNum;
        const details = await prisma.serviceOrder.findMany({
            where: { soNum: firstSoNum },
            select: { soNum: true, status: true, sltsStatus: true, createdAt: true, opmcId: true }
        });
        console.log(`Details for ${firstSoNum}:`, JSON.stringify(details, null, 2));
    }
}

checkDuplicates()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
