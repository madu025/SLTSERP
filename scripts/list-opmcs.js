const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    const opmcs = await prisma.oPMC.findMany({
        include: { store: true }
    });
    console.log("OPMCs with Store Info:");
    console.log(opmcs.map(o => `${o.rtom} | ${o.name} | Store: ${o.store ? o.store.name : 'None'}`));

    const stores = await prisma.inventoryStore.findMany();
    console.log("\nAll Stores in Database:");
    console.log(stores.map(s => `${s.id} | ${s.name} | Type: ${s.type}`));

    const contractors = await prisma.contractor.findMany();
    console.log("\nAll Contractors in Database:");
    console.log(contractors.map(c => `${c.id} | ${c.name} | OpmcId: ${c.opmcId}`));
}
check().finally(() => prisma.$disconnect());
