const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function listMaterials() {
    try {
        const items = await prisma.inventoryItem.findMany({
            where: { isOspFtth: true },
            select: { name: true, importAliases: true, source: true }
        });

        console.log('--- OSP FTTH Materials for Excel Headers ---');
        items.forEach(item => {
            const displayName = item.name + (item.source ? ` (${item.source})` : '');
            const aliases = item.importAliases && item.importAliases.length > 0
                ? ` [Aliases: ${item.importAliases.join(', ')}]`
                : '';
            console.log(`${displayName}${aliases}`);
        });

    } catch (err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}

listMaterials();
