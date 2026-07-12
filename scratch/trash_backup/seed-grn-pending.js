const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const storeId = 'cmqm196ap001esivorzq0ncjp'; // Nittambuwa Store
  const itemId = '04bac77a-9c46-4829-925d-343ee9b40f5d'; // FAC Connector (G1)
  const requestedById = 'cmqm18vbx0004sivo2kucbkk3'; // storesmanager

  const requestNr = `REQ-TEST-${Date.now().toString().slice(-6)}`;

  // Delete any stale test request with the same pattern to keep DB clean
  await prisma.stockRequest.deleteMany({
    where: { requestNr: { startsWith: 'REQ-TEST-' } }
  });

  const req = await prisma.stockRequest.create({
    data: {
      requestNr,
      fromStoreId: storeId,
      requestedById,
      status: 'APPROVED',
      priority: 'HIGH',
      sourceType: 'SLT',
      workflowStage: 'GRN_PENDING',
      purpose: 'E2E Testing',
      items: {
        create: [
          {
            itemId,
            requestedQty: 10,
            approvedQty: 10
          }
        ]
      }
    }
  });

  console.log(`✅ Success! Seeded pending request ready for GRN: ID=${req.id}, Number=${req.requestNr}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
