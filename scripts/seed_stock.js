const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log('Checking database for stores...');
    const stores = await prisma.inventoryStore.findMany();
    console.log('Stores found:', stores.map(s => ({ id: s.id, name: s.name, type: s.type })));

    const items = await prisma.inventoryItem.findMany();
    console.log('Total items in catalog:', items.length);

    if (stores.length === 0) {
        console.log('No stores found, creating mock store...');
        const mockStore = await prisma.inventoryStore.create({
            data: {
                id: 'colombo-main-001',
                name: 'Colombo Central Main Store',
                type: 'MAIN',
                location: 'Colombo 10'
            }
        });
        stores.push(mockStore);
    }

    if (items.length === 0) {
        console.log('No items found, creating mock items...');
        const mockItem1 = await prisma.inventoryItem.create({
            data: {
                code: 'CABLE-FO-01',
                name: 'Fiber Drop Cable (4 Core)',
                unit: 'm',
                category: 'CABLE',
                hasSerial: false,
                minLevel: 1000
            }
        });
        const mockItem2 = await prisma.inventoryItem.create({
            data: {
                code: 'ONT-FTTH-01',
                name: 'ONT Router dual-band FTTH',
                unit: 'Nos',
                category: 'ONT',
                hasSerial: true,
                minLevel: 10
            }
        });
        items.push(mockItem1, mockItem2);
        console.log('Mock items created.');
    }

    const firstStore = stores[0];
    console.log(`Seeding stock for store: ${firstStore.name} (${firstStore.id})`);

    for (const item of items) {
        const existingStock = await prisma.inventoryStock.findUnique({
            where: {
                storeId_itemId: {
                    storeId: firstStore.id,
                    itemId: item.id
                }
            }
        });

        if (!existingStock) {
            await prisma.inventoryStock.create({
                data: {
                    storeId: firstStore.id,
                    itemId: item.id,
                    quantity: item.hasSerial ? 15 : 2500,
                    minLevel: item.minLevel
                }
            });
            console.log(`Initialized stock level for ${item.name}`);
        } else {
            console.log(`Stock level already exists for ${item.name}: ${existingStock.quantity}`);
        }

        // Seed some batches for FIFO breakdown
        const existingBatches = await prisma.inventoryBatch.findMany({
            where: { itemId: item.id }
        });

        if (existingBatches.length === 0) {
            const batch1 = await prisma.inventoryBatch.create({
                data: {
                    batchNumber: `B-${item.code}-001`,
                    itemId: item.id,
                    initialQty: item.hasSerial ? 10 : 1500,
                    costPrice: 4500,
                    unitPrice: 5000,
                }
            });

            const batch2 = await prisma.inventoryBatch.create({
                data: {
                    batchNumber: `B-${item.code}-002`,
                    itemId: item.id,
                    initialQty: item.hasSerial ? 5 : 1000,
                    costPrice: 4800,
                    unitPrice: 5500,
                }
            });

            // Associate batch stock levels
            await prisma.inventoryBatchStock.create({
                data: { storeId: firstStore.id, itemId: item.id, batchId: batch1.id, quantity: item.hasSerial ? 10 : 1500 }
            });
            await prisma.inventoryBatchStock.create({
                data: { storeId: firstStore.id, itemId: item.id, batchId: batch2.id, quantity: item.hasSerial ? 5 : 1000 }
            });
            console.log(`Seeded batches for ${item.name}`);
        }

        // Seed serial numbers if needed
        if (item.hasSerial) {
            const existingSerials = await prisma.inventoryItemSerial.findMany({
                where: { itemId: item.id, storeId: firstStore.id }
            });

            if (existingSerials.length === 0) {
                const serialsToCreate = Array.from({ length: 15 }).map((_, i) => ({
                    itemId: item.id,
                    serialNumber: `SN-${item.code}-${1000 + i}`,
                    status: 'IN_STORE',
                    storeId: firstStore.id
                }));

                await prisma.inventoryItemSerial.createMany({
                    data: serialsToCreate
                });
                console.log(`Seeded 15 serial numbers for ${item.name}`);
            }
        }
    }

    console.log('Seeding stock levels completed successfully!');
}

main()
    .catch(e => {
        console.error('Error seeding stock levels:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
