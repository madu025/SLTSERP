import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function inspectInventoryStores() {
    console.log('🔍 === INSPECTING INVENTORY STORES & TEAM STORE ASSIGNMENTS ===\n');

    const stores = await prisma.inventoryStore.findMany({
        include: {
            opmcs: true,
            _count: { select: { opmcs: true, batchStocks: true, serials: true, mrns: true } }
        },
        orderBy: { createdAt: 'desc' }
    });

    console.log(`Total Inventory Stores in database: ${stores.length}\n`);

    const typeCounts: Record<string, number> = {};
    stores.forEach(s => {
        typeCounts[s.type] = (typeCounts[s.type] || 0) + 1;
    });

    console.log('Stores breakdown by type:', typeCounts);

    console.log('\nSample 20 Stores:');
    stores.slice(0, 20).forEach(s => {
        console.log(`• ID: ${s.id} | Name: "${s.name}" | Type: ${s.type} | Location: ${s.location || 'N/A'} | Linked OPMCs: ${s._count.opmcs}`);
    });
}

inspectInventoryStores()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
