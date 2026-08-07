const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const kaduwelaStore = await prisma.inventoryStore.findFirst({
        where: { name: { contains: 'Kaduwela', mode: 'insensitive' } }
    });

    if (!kaduwelaStore) {
        console.log('Kaduwela Store not found');
        return;
    }

    console.log('Found Kaduwela Store:', kaduwelaStore.id, kaduwelaStore.name);

    const storesmanager = await prisma.user.findFirst({
        where: { username: 'storesmanager' }
    });

    if (!storesmanager) {
        console.log('storesmanager user not found');
        return;
    }

    console.log('Found storesmanager:', storesmanager.id, storesmanager.name);

    await prisma.user.update({
        where: { id: storesmanager.id },
        data: { assignedStoreId: kaduwelaStore.id }
    });

    console.log('Assigned Kaduwela Store to storesmanager');

    // Also set the store manager
    await prisma.inventoryStore.update({
        where: { id: kaduwelaStore.id },
        data: { managerId: storesmanager.id }
    });

    console.log('Set storesmanager as Kaduwela Store manager');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
