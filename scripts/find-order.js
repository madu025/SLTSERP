const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const soNum = 'TBT202606090010543';
    console.log(`Searching for service order ${soNum}...`);
    const order = await prisma.serviceOrder.findUnique({
        where: { soNum },
        include: {
            contractor: true,
            team: true,
            materialUsage: {
                include: {
                    item: true
                }
            }
        }
    });
    console.log("Order details:");
    console.log(JSON.stringify(order, null, 2));

    const opmcId = order.opmcId;
    console.log(`\nListing contractors for OPMC ${opmcId}...`);
    const contractors = await prisma.contractor.findMany({
        where: { opmcId },
        include: {
            teams: true
        }
    });
    console.log(JSON.stringify(contractors.map(c => ({ id: c.id, name: c.name, teams: c.teams.map(t => ({ id: t.id, name: t.name })) })), null, 2));

    console.log(`\nListing items with stock in OPMC Store (opmcId: ${opmcId})...`);
    const opmc = await prisma.oPMC.findUnique({
        where: { id: opmcId }
    });
    if (opmc && opmc.storeId) {
        const stocks = await prisma.inventoryStock.findMany({
            where: { storeId: opmc.storeId },
            include: {
                item: true
            }
        });
        console.log(JSON.stringify(stocks.map(s => ({ itemId: s.itemId, itemName: s.item.name, quantity: s.quantity })), null, 2));
    } else {
        console.log("No storeId found for this OPMC");
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
