import { config } from 'dotenv'; config({ path: '.env.local' });
// Takes the open ZZTEST requests out of the real queues (they stay as REJECTED rows for the audit trail). Only requests whose store is a ZZTEST/ZZG2 store.
(async () => {
  const { prisma } = await import('../src/lib/prisma');
  const isZz = { OR: [{ name: { startsWith: 'ZZTEST' } }, { name: { startsWith: 'ZZG2' } }, { name: { startsWith: 'ZZGUI' } }] };
  const open = await prisma.stockRequest.findMany({ where: { status: { in: ['PENDING', 'APPROVED'] }, OR: [{ fromStore: isZz }, { toStore: isZz }] }, select: { id: true, requestNr: true, status: true, fromStore: { select: { name: true } } } });
  console.log('open ZZ requests', open.length, JSON.stringify(open.map((r) => `${r.requestNr}:${r.status}:${r.fromStore?.name?.slice(0, 18)}`).slice(0, 20)));
  const r = await prisma.stockRequest.updateMany({ where: { id: { in: open.map((o) => o.id) } }, data: { status: 'REJECTED', workflowStage: 'REJECTED', remarks: 'ZZTEST data closed after the end to end test' } as any });
  const stillPending = await prisma.stockRequest.count({ where: { status: { in: ['PENDING', 'APPROVED'] } } });
  console.log('rejected', r.count, '| open requests left (all stores):', stillPending);
  process.exit(0);
})();
