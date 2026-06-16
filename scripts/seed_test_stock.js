const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    // 1. Get a Store (e.g., Kaduwela or any)
    const store = await prisma.inventoryStore.findFirst();
    if (!store) {
        console.error("No stores found!");
        return;
    }
    console.log(`Using Store: ${store.name} (${store.id})`);

    // 2. Get an Item
    const item = await prisma.inventoryItem.findFirst();
    if (!item) {
        console.error("No items found!");
        return;
    }
    console.log(`Using Item: ${item.name} (${item.code})`);

    // 3. Add Stock
    // Using prisma.$executeRaw or direct update if model exists
    // The schema has 'CurrentStock' or 'InventoryStock'? 
    // Let's check schema/service usage. Service uses 'InventoryStock' in recent changes?
    // Wait, the previous `replace_file_content` used `InventoryStock`.
    // Let's try upsert on InventoryStock.

    try {
        await prisma.inventoryStock.upsert({
            where: {
                storeId_itemId: {
                    storeId: store.id,
                    itemId: item.id
                }
            },
            update: {
                quantity: 1000
            },
            create: {
                storeId: store.id,
                itemId: item.id,
                quantity: 1000,
                minLevel: 10
            }
        });
        console.log("Successfully added 1000 units of stock.");
    } catch (e) {
        console.error("Error adding stock:", e);
        // Fallback: Check if it's CurrentStock model (old vs new schema confusion from previous context)
        // Trying CurrentStock just in case
        try {
            await prisma.currentStock.upsert({
                where: {
                    storeId_itemId: { // Check if this composite key exists in CurrentStock
                        storeId: store.id,
                        itemId: item.id
                    }
                },
                update: { quantity: 1000 },
                create: { storeId: store.id, itemId: item.id, quantity: 1000 }
            });
            console.log("Added to CurrentStock instead.");
        } catch (e2) {
            console.error("Also failed CurrentStock:", e2);
        }
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
