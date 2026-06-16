
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const sltsItems = await prisma.inventoryItem.findMany({
        where: { source: 'SLTS' },
        select: { id: true, code: true, name: true, commonName: true, source: true }
    });
    console.log('SLTS Items:', JSON.stringify(sltsItems, null, 2));

    const itemsWithCommonName = await prisma.inventoryItem.findMany({
        where: { commonName: { not: null } },
        select: { id: true, code: true, name: true, commonName: true, source: true }
    });
    console.log('Items with Common Name:', JSON.stringify(itemsWithCommonName, null, 2));
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
