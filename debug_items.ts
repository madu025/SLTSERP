import { prisma } from './src/lib/prisma';
async function main() {
    try {
        const items = await prisma.inventoryItem.findMany({
            where: {
                OR: [
                    { name: { contains: 'Drop Wire', mode: 'insensitive' } },
                    { code: { contains: 'OSPFTA', mode: 'insensitive' } }
                ]
            }
        });
        console.log('MATCHING_ITEMS:', JSON.stringify(items, null, 2));
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}
main();
