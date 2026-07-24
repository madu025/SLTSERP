import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyStep2() {
  console.log('🔍 Checking Live Database Status for Contractor Virtual Van Stock...');

  const contractor = await prisma.contractor.findFirst({ where: { status: 'ACTIVE' } });
  if (!contractor) throw new Error('Contractor not found');

  const stocks = await prisma.contractorStock.findMany({
    where: { contractorId: contractor.id },
    include: { item: true }
  });

  const acceptedIssues = await prisma.contractorMaterialIssue.findMany({
    where: { contractorId: contractor.id, status: 'ACCEPTED' },
    include: { items: { include: { item: true } } }
  });

  console.log(`Contractor: ${contractor.name}`);
  console.log(`Accepted Dispatches: ${acceptedIssues.length}`);

  for (const issue of acceptedIssues) {
    console.log(`  - Issue ID ${issue.id}: Signed by "${issue.signatureUrl}" at ${issue.acceptedAt}`);
  }

  console.log('\n📋 Current Virtual Van Stock Balances:');
  if (stocks.length === 0) {
    console.log('  (No stock records yet - awaiting user click on "Confirm & Transfer Custody")');
  } else {
    for (const s of stocks) {
      console.log(`  • ${s.item.name} (${s.item.code}): ${s.quantity} ${s.item.unit}`);
    }
  }

  await prisma.$disconnect();
}

verifyStep2().catch(console.error);
