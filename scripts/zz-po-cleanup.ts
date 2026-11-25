import { config } from 'dotenv'; config({ path: '.env.local' });
// Takes the open ZZTEST / ZZG3 purchase orders out of the real procurement lists: an order with nothing received is cancelled, a part received one is closed.
(async () => {
  const { prisma } = await import('../src/lib/prisma');
  const { PurchaseOrderService } = await import('../src/services/procurement/purchase-order.service');
  const admin = (await prisma.user.findFirstOrThrow({ where: { username: { equals: 'admin', mode: 'insensitive' } }, select: { id: true } })).id;
  const open = await prisma.purchaseOrder.findMany({ where: { status: { in: ['PENDING_APPROVAL', 'APPROVED', 'ISSUED', 'PARTIALLY_RECEIVED'] }, OR: [{ vendor: { startsWith: 'ZZTEST' } }, { vendor: { startsWith: 'ZZG3' } }, { vendorRef: { name: { startsWith: 'ZZTEST' } } }] }, select: { id: true, poNumber: true, status: true, vendor: true, items: { select: { receivedQty: true } } } });
  console.log('open ZZ orders', open.length);
  let cancelled = 0, closed = 0; const failed: string[] = [];
  for (const po of open) {
    try {
      const received = po.items.some((i) => Number(i.receivedQty) > 0);
      if (!received) { await PurchaseOrderService.cancelStorePo(po.id, admin, 'ZZTEST data closed after the end to end test'); cancelled++; }
      else { await PurchaseOrderService.closeStorePo(po.id, admin); closed++; }
    } catch (e: any) { failed.push(`${po.poNumber}:${po.status}:${String(e?.message ?? e).slice(0, 60)}`); }
  }
  console.log(JSON.stringify({ cancelled, closed, failed }));
  process.exit(0);
})();
