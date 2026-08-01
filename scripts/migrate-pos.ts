import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migratePOs() {
  console.log('Starting Data Migration for POs...');

  try {
    // 1. Find all StockRequests that have a poNumber
    const requestsWithPOs = await prisma.stockRequest.findMany({
      where: {
        poNumber: {
          not: null,
        },
      },
      include: {
        items: true,
      },
    });

    console.log(`Found ${requestsWithPOs.length} StockRequests with POs to migrate.`);

    for (const request of requestsWithPOs) {
      if (!request.poNumber || !request.vendor) continue;

      // 2. Check if a PurchaseOrder already exists for this PRN to avoid duplicates
      const existingPO = await prisma.purchaseOrder.findUnique({
        where: { poNumber: request.poNumber },
      });

      if (existingPO) {
        console.log(`PO ${request.poNumber} already migrated. Skipping.`);
        continue;
      }

      console.log(`Migrating PO: ${request.poNumber} for PRN: ${request.requestNr}`);

      // 3. Create the PurchaseOrder and its items
      await prisma.$transaction(async (tx) => {
        const newPO = await tx.purchaseOrder.create({
          data: {
            poNumber: request.poNumber!,
            vendor: request.vendor!,
            expectedDelivery: request.expectedDelivery,
            status: request.procurementStatus === 'COMPLETED' ? 'COMPLETED' : 'APPROVED',
            stockRequestId: request.id,
          },
        });

        // 4. Create PurchaseOrderItems for each StockRequestItem
        const poItemsData = request.items.map((item) => ({
          purchaseOrderId: newPO.id,
          stockRequestItemId: item.id,
          quantity: item.approvedQty > 0 ? item.approvedQty : item.requestedQty,
          unitPrice: 0,
          taxAmount: 0,
          totalAmount: 0,
        }));

        if (poItemsData.length > 0) {
          await tx.purchaseOrderItem.createMany({
            data: poItemsData,
          });
        }
      });
    }

    console.log('Data Migration for POs completed successfully.');
  } catch (error) {
    console.error('Error during PO migration:', error);
  } finally {
    await prisma.$disconnect();
  }
}

migratePOs();
