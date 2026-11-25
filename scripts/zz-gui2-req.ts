import { config } from 'dotenv'; config({ path: '.env.local' });
async function main() {
    const { prisma } = await import('../src/lib/prisma');
    const { InventoryService } = await import('../src/services/inventory');
    const kad = await prisma.inventoryStore.findFirstOrThrow({ where: { name: { contains: 'ZZG2' }, type: 'SUB', location: 'ZZTEST' }, orderBy: { createdAt: 'desc' } });
    const main = await prisma.inventoryStore.findFirstOrThrow({ where: { name: { contains: 'ZZG2' }, type: 'MAIN' }, orderBy: { createdAt: 'desc' } });
    const officer = await prisma.user.findFirstOrThrow({ where: { username: 'zzg2_officer' } });
    const items = await prisma.inventoryItem.findMany({ where: { code: { startsWith: kad.name.split(' ')[0] } } });
    const a = items.find((i) => i.code.endsWith('-A'))!, b = items.find((i) => i.code.endsWith('-B'))!;
    const r: any = await InventoryService.createStockRequest({ fromStoreId: kad.id, toStoreId: main.id, sourceType: 'MAIN_STORE', requestedById: officer.id, priority: 'NORMAL', purpose: 'ZZG2 material for Kaduwela', items: [{ itemId: a.id, requestedQty: 60 }, { itemId: b.id, requestedQty: 30 }] } as any);
    console.log('request', r.requestNr);
    process.exit(0);
}
main();
