import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { prisma } from '../../../src/lib/prisma';
import { InventoryRepository } from '../../../src/repositories/inventory.repository';
import { PaymentVoucherService } from '../../../src/services/finance/payment-voucher.service';
import { StockService } from '../../../src/services/inventory/stock.service';

const restorers: Array<() => void> = [];
function stub(target: object, key: string, implementation: unknown) {
  const original = Reflect.get(target, key);
  Reflect.set(target, key, implementation);
  restorers.push(() => { Reflect.set(target, key, original); });
}
afterEach(() => { while (restorers.length) restorers.pop()!(); });

test('scoped finance reader only queries vouchers in assigned OPMCs', async () => {
  let where: Record<string, unknown> = {};
  stub(prisma.user, 'findUnique', async () => ({
    permissions: [], accessibleOpmcs: [{ id: 'opmc-a' }], systemRole: null, sectionAssignments: [],
  }));
  stub(prisma.paymentVoucher, 'findMany', async (args: { where: Record<string, unknown> }) => {
    where = args.where;
    return [];
  });
  await PaymentVoucherService.getPaymentVouchers({}, 'reader');
  assert.deepEqual(where.project, { opmcId: { in: ['opmc-a'] } });
});

test('inventory issue query is limited to accessible stores', async () => {
  let where: Record<string, unknown> = {};
  stub(InventoryRepository, 'findManyStockIssues', async (args: { where: Record<string, unknown> }) => {
    where = args.where;
    return [];
  });
  await StockService.getStockIssues({ allowedStoreIds: ['store-a'] });
  assert.deepEqual(where.storeId, { in: ['store-a'] });
  await assert.rejects(
    () => StockService.getStockIssues({ storeId: 'store-b', allowedStoreIds: ['store-a'] }),
    /STORE_SCOPE_VIOLATION/,
  );
});
