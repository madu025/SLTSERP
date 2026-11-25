import { config } from 'dotenv'; config({ path: '.env.local' });
(async () => {
  const { prisma } = await import('../src/lib/prisma');
  const { InventoryService } = await import('../src/services/inventory');
  const kad = await prisma.inventoryStore.findFirstOrThrow({ where: { name: { contains: 'ZZG2' }, type: 'SUB', location: 'ZZTEST' }, orderBy: { createdAt: 'desc' } });
  const officer = await prisma.user.findFirstOrThrow({ where: { username: 'zzg2_officer' } });
  const contractor = await prisma.contractor.findFirstOrThrow({ where: { name: { contains: 'ZZG2' }, registrationNumber: { endsWith: '-C' } }, orderBy: { createdAt: 'desc' } });
  const items = await prisma.inventoryItem.findMany({ where: { code: { startsWith: kad.name.split(' ')[0] } } });
  const a = items.find((i) => i.code.endsWith('-A'))!, b = items.find((i) => i.code.endsWith('-B'))!;
  const month = new Date().toISOString().slice(0, 7);
  await InventoryService.issueMaterial({ contractorId: contractor.id, storeId: kad.id, month, userId: officer.id, items: [{ itemId: a.id, quantity: 12 }, { itemId: b.id, quantity: 7 }] } as any);
  const issue = await prisma.contractorMaterialIssue.findFirst({ where: { contractorId: contractor.id }, orderBy: { createdAt: 'desc' }, select: { issueNumber: true, status: true } });
  console.log('ISSUE', JSON.stringify(issue));
  process.exit(0);
})();
