import { prisma } from './src/lib/prisma';
async function main() {
    const items = await prisma.inventoryItem.findMany({
        where: { OR: [{ code: { contains: 'OSP' } }, { name: { contains: 'Fiber' } }] },
        select: { id: true, code: true, name: true, type: true }
    });
    console.log(JSON.stringify(items, null, 2));
}
main();
