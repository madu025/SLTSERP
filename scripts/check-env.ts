import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const stores = await prisma.inventoryStore.findMany({
    include: { opmcs: true }
  });
  console.log('Stores count:', stores.length);
  for (const s of stores) {
    console.log(`Store: ${s.name} (${s.id}), type: ${s.type}, OPMCs:`, s.opmcs.map(o => o.name));
  }

  const opmcs = await prisma.oPMC.findMany();
  console.log('OPMCs count:', opmcs.length);
  for (const o of opmcs) {
    console.log(`OPMC: ${o.name} (${o.id}), rtom: ${o.rtom}, storeId: ${o.storeId}`);
  }

  const contractors = await prisma.contractor.findMany();
  console.log('Contractors count:', contractors.length);
  for (const c of contractors) {
    console.log(`Contractor: ${c.name} (${c.id}), status: ${c.status}, opmcId: ${c.opmcId}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
