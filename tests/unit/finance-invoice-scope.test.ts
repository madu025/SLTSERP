/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma stubs verify scoped invoice queries and mutation guards. */
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { prisma } from '../../src/lib/prisma';
import { InvoiceService } from '../../src/services/finance/invoice.service';
import { InvoiceApprovalService } from '../../src/services/finance/invoice-approval.service';

const db = prisma as any;
const original = {
  userFindUnique: db.user.findUnique,
  invoiceFindMany: db.invoice.findMany,
  invoiceCount: db.invoice.count,
  invoiceFindUnique: db.invoice.findUnique,
  transaction: db.$transaction,
};
afterEach(() => {
  db.user.findUnique = original.userFindUnique;
  db.invoice.findMany = original.invoiceFindMany;
  db.invoice.count = original.invoiceCount;
  db.invoice.findUnique = original.invoiceFindUnique;
  db.$transaction = original.transaction;
});

function scopedActor() {
  db.user.findUnique = async () => ({
    permissions: JSON.stringify(['finance.read', 'finance.approve']),
    accessibleOpmcs: [{ id: 'opmc-1' }], systemRole: null, sectionAssignments: [],
  });
}

test('contractor invoice list is limited to assigned OPMCs', async () => {
  scopedActor();
  let where: any;
  db.invoice.findMany = async (args: any) => { where = args.where; return []; };
  db.invoice.count = async () => 0;
  await InvoiceService.getInvoices({ page: 1, limit: 10 }, 'actor-1');
  assert.deepEqual(where.project, { opmcId: { in: ['opmc-1'] } });
});

test('scoped approver cannot approve an invoice with no project boundary', async () => {
  scopedActor();
  db.invoice.findUnique = async () => ({ projectId: null });
  db.$transaction = async () => { throw new Error('write reached'); };
  await assert.rejects(() => InvoiceApprovalService.approveInvoice('invoice-1', 'actor-1'), /outside assigned OPMC scope/);
});
