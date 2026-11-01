/* eslint-disable @typescript-eslint/no-explicit-any -- In-memory Prisma adapter models the write chain. */
import assert from 'node:assert/strict';
import { afterEach, mock, test } from 'node:test';
import { prisma } from '../../src/lib/prisma';
import { OSPAccountCrudService } from '../../src/services/finance/osp-account-crud.service';
import { PettyCashService } from '../../src/services/finance/petty-cash.service';
import { OSPLedgerService } from '../../src/services/finance/osp-ledger.service';
import { LedgerService } from '../../src/services/finance/ledger.service';

const restorers: Array<() => void> = [];
function stub(target: object, key: string, implementation: unknown) {
  const original = Reflect.get(target, key);
  Reflect.set(target, key, implementation);
  restorers.push(() => Reflect.set(target, key, original));
}

afterEach(() => {
  while (restorers.length) restorers.pop()!();
  mock.restoreAll();
});

test('OSP IOU write chain creates a pending advance, approves it, and posts to OSP ledger', async () => {
  let iou: any = null;
  const ledgerEvents: any[] = [];
  const tx = {
    ospPettyCashIou: {
      findUnique: async () => iou,
      update: async ({ data }: any) => { iou = { ...iou, ...data }; return iou; },
    },
  };

  stub(prisma.ospPettyCashIou, 'findUnique', async () => iou);
  stub(prisma.ospPettyCashIou, 'create', async ({ data }: any) => {
    iou = { id: 'iou-1', ...data };
    return iou;
  });
  stub(prisma, '$transaction', async (callback: (client: typeof tx) => unknown) => callback(tx));
  mock.method(OSPLedgerService, 'postAutomatedTransaction', async (_tx: unknown, event: unknown) => {
    ledgerEvents.push(event);
  });

  const created = await OSPAccountCrudService.createIOU({
    iouNumber: 'IOU-QA-001', staffName: 'QA Staff', amount: 100,
  });
  assert.equal(created.status, 'PENDING');

  const approved = await OSPAccountCrudService.approveIOU('iou-1');
  assert.equal(approved.status, 'APPROVED');
  assert.equal(ledgerEvents[0].sourceModule, 'OSP_IOU');
  assert.equal(ledgerEvents[0].transactionType, 'ISSUE_ADVANCE');
  assert.equal(ledgerEvents[0].amount, 100);
});

test('Petty Cash write chain creates, approves, reimburses, and replenishes the ledger balance', async () => {
  const account: any = {
    id: 'pc-1', name: 'QA Petty Cash', opmcId: 'opmc-1', imprestLimit: 500,
    currentBalance: 500, status: 'ACTIVE', opmc: { rtom: 'QA' },
  };
  const voucher: any = { id: 'voucher-1', amount: 100, title: 'QA travel', category: 'TRAVEL', status: 'DRAFT', reimbursementId: null };
  let reimbursement: any = null;
  const ledgerEvents: string[] = [];
  const tx = {
    pettyCashAccount: {
      findUnique: async () => account,
      update: async ({ data }: any) => { Object.assign(account, data); return account; },
    },
    pettyCashVoucher: {
      findUnique: async () => ({ ...voucher, account }),
      update: async ({ data }: any) => { Object.assign(voucher, data); return voucher; },
      updateMany: async ({ data }: any) => { Object.assign(voucher, data); return { count: 1 }; },
      findMany: async () => [voucher].filter((item) => item.status === 'APPROVED' && !item.reimbursementId),
    },
    pettyCashReimbursement: {
      findFirst: async () => null,
      count: async () => 0,
      create: async ({ data }: any) => { reimbursement = { id: 'reimbursement-1', ...data }; return reimbursement; },
      findUnique: async () => ({ ...reimbursement, account, vouchers: [voucher] }),
      update: async ({ data }: any) => { Object.assign(reimbursement, data); return reimbursement; },
    },
  };

  stub(prisma.pettyCashAccount, 'findUnique', async () => account);
  stub(prisma.pettyCashVoucher, 'count', async () => 0);
  stub(prisma.pettyCashVoucher, 'create', async ({ data }: any) => { Object.assign(voucher, data); return voucher; });
  stub(prisma, '$transaction', async (callback: (client: typeof tx) => unknown) => callback(tx));
  mock.method(LedgerService, 'logPettyCashExpense', async () => { ledgerEvents.push('expense'); });
  mock.method(LedgerService, 'logPettyCashReimbursement', async () => { ledgerEvents.push('reimbursement'); });

  const created = await PettyCashService.createVoucher({
    accountId: 'pc-1', title: 'QA travel', amount: 100, category: 'TRAVEL', createdById: 'maker',
  });
  assert.equal(created.status, 'DRAFT');

  const approved = await PettyCashService.approveVoucher('voucher-1', 'checker');
  assert.equal(approved.status, 'APPROVED');
  assert.equal(account.currentBalance, 400);
  assert.deepEqual(ledgerEvents, ['expense']);

  const request = await PettyCashService.requestReimbursement('pc-1', 'maker');
  assert.equal(request.status, 'PENDING');
  assert.equal(voucher.reimbursementId, 'reimbursement-1');

  const completed = await PettyCashService.completeReimbursement('reimbursement-1', 'pv-1', 'checker');
  assert.equal(completed.status, 'REIMBURSED');
  assert.equal(voucher.status, 'REIMBURSED');
  assert.equal(account.currentBalance, 500);
  assert.deepEqual(ledgerEvents, ['expense', 'reimbursement']);
});
