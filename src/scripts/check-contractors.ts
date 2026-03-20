import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const pending = await prisma.contractor.findMany({
    where: { status: { in: ['ARM_PENDING', 'OSP_PENDING'] } }
  });
  
  if (pending.length === 0) {
    console.log("No pending approvals found.");
    return;
  }

  console.log(`Found ${pending.length} pending approvals:`);
  pending.forEach(p => {
    console.log(`- ID: ${p.id}, Name: ${p.name}, Status: ${p.status}, OPMC ID: ${p.opmcId}`);
  });
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
