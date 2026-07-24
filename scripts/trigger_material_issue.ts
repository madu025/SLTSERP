import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function triggerDispatch() {
  console.log('📦 Triggering Real-Time Material Dispatch from Main Store to Contractor CONSTRUCT_OSP...');

  const contractor = await prisma.contractor.findFirst({ where: { status: 'ACTIVE' } });
  if (!contractor) throw new Error('Active contractor not found');

  const mainStore = await prisma.inventoryStore.findFirst() || { id: contractor.id };
  const dwItem = await prisma.inventoryItem.findFirst({ where: { OR: [{ code: { contains: 'DW' } }, { category: 'CONSUMABLE' }] } });
  const ontItem = await prisma.inventoryItem.findFirst({ where: { OR: [{ code: { contains: 'ONT' } }, { hasSerial: true }] } });

  if (!dwItem || !ontItem) throw new Error('Catalog items missing');

  const issue = await prisma.contractorMaterialIssue.create({
    data: {
      contractorId: contractor.id,
      storeId: mainStore.id,
      month: new Date().toLocaleString('default', { month: 'long', year: 'numeric' }),
      status: 'PENDING_ACCEPTANCE',
      items: {
        create: [
          { itemId: dwItem.id, quantity: 350, unit: 'Meters' },
          { itemId: ontItem.id, quantity: 8, unit: 'Pcs' }
        ]
      }
    }
  });

  console.log(`✅ Material Issue Created: ID ${issue.id}`);
  console.log('📱 Contractor Mobile App should now show this pending issue in REAL-TIME within 5 seconds!');
  await prisma.$disconnect();
}

triggerDispatch().catch(console.error);
