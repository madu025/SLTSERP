
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const sources = await prisma.inventoryItem.groupBy({
        by: ['source'],
        _count: { id: true }
    });
    const types = await prisma.inventoryItem.groupBy({
        by: ['type'],
        _count: { id: true }
    });

    console.log('Sources:', JSON.stringify(sources, null, 2));
    console.log('Types:', JSON.stringify(types, null, 2));

    const items = await prisma.inventoryItem.findMany({
        where: {
            OR: [
                { source: { not: 'SLT' } },
                { type: { not: 'SLTS' } }
            ]
        },
        select: { code: true, name: true, commonName: true, source: true, type: true },
        take: 20
    });
    console.log('Sample non-standard items:', JSON.stringify(items, null, 2));
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
