import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const grn = await prisma.gRN.findUnique({
    where: { grnNumber: 'GRN-2026-08-0002' },
  });
  console.log(grn);
}

main().finally(() => prisma.$disconnect());
