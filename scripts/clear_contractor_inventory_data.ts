import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function clearContractorInventoryData() {
  console.log('🧹 Clearing Contractor Inventory Data for Clean Slate Testing...');

  const contractor = await prisma.contractor.findFirst({
    where: { status: 'ACTIVE' }
  });

  if (!contractor) {
    console.error('No active contractor found');
    return;
  }

  console.log(`Target Contractor: ${contractor.name} (${contractor.id})`);

  // Delete all material issue items & issues
  const contractorIssues = await prisma.contractorMaterialIssue.findMany({
    where: { contractorId: contractor.id },
    select: { id: true }
  });

  const issueIds = contractorIssues.map(i => i.id);

  if (issueIds.length > 0) {
    const deletedItems = await prisma.contractorMaterialIssueItem.deleteMany({
      where: { issueId: { in: issueIds } }
    });
    console.log(`- Deleted ${deletedItems.count} Material Issue Items`);

    const deletedIssues = await prisma.contractorMaterialIssue.deleteMany({
      where: { contractorId: contractor.id }
    });
    console.log(`- Deleted ${deletedIssues.count} Contractor Material Issues`);
  } else {
    console.log('- No existing Material Issues to delete');
  }

  // Delete/reset virtual stock
  const deletedStock = await prisma.contractorStock.deleteMany({
    where: { contractorId: contractor.id }
  });
  console.log(`- Cleared ${deletedStock.count} Contractor Stock Records`);

  console.log('\n✨ Contractor Inventory is now 100% CLEAN & RESET for Testing!');
  await prisma.$disconnect();
}

clearContractorInventoryData().catch(console.error);
