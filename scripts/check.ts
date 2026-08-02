import { prisma } from '../src/lib/prisma';
async function run() {
  const req = await prisma.stockRequest.findFirst({
    where: { requestNr: "PRN-20260801-5772" },
    include: { purchaseOrders: true }
  });
  console.log(JSON.stringify(req, null, 2));
}
run().finally(() => prisma.$disconnect());
