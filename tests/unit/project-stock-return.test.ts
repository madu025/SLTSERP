/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma service stubs model only the exercised transaction calls. */
import assert from 'node:assert/strict';
import { afterEach, it } from 'node:test';

import { prisma } from '../../src/lib/prisma';
import { StoreService } from '../../src/services/inventory/store.service';
import { AuditLedgerService } from '../../src/services/inventory/audit-ledger.service';
import { ProjectStockIssueService } from '../../src/services/project/project-stock-issue.service';

const db = prisma as any;
const originalFindReturn = db.projectMaterialReturn.findUnique;
const originalFindIssue = db.stockIssue.findUnique;
const originalFindUser = db.user.findUnique;
const originalTransaction = db.$transaction;
const originalStoreAccess = StoreService.assertStoreWriteAccess;
const originalRecordEntry = AuditLedgerService.recordEntry;
const originalGenerateMRN = AuditLedgerService.generateMRNNumber;

afterEach(() => {
  db.projectMaterialReturn.findUnique = originalFindReturn;
  db.stockIssue.findUnique = originalFindIssue;
  db.user.findUnique = originalFindUser;
  db.$transaction = originalTransaction;
  StoreService.assertStoreWriteAccess = originalStoreAccess;
  AuditLedgerService.recordEntry = originalRecordEntry;
  AuditLedgerService.generateMRNNumber = originalGenerateMRN;
});

it('rejects self-approval of a stock issue even for an administrative actor', async () => {
  db.stockIssue.findUnique = async () => ({
    id: 'issue-1', projectId: null, storeId: 'store-1', status: 'PENDING',
    issuedById: 'user-1', items: [],
  });
  db.user.findUnique = async () => ({ id: 'user-1' });
  StoreService.assertStoreWriteAccess = async () => {};
  db.$transaction = async () => { throw new Error('transaction must not start'); };

  await assert.rejects(
    ProjectStockIssueService.approveIssueRequest('issue-1', 'user-1'),
    /SEGREGATION_OF_DUTIES_VIOLATION/,
  );
});

it('reserves return quantity against one approved issue under a row lock', async () => {
  const order: string[] = [];
  let created: any;
  StoreService.assertStoreWriteAccess = async () => {};
  AuditLedgerService.generateMRNNumber = async () => 'MRN-2026-10-0002';
  db.$transaction = async (callback: (tx: any) => Promise<unknown>) => callback({
    $queryRaw: async () => { order.push('lock'); return [{ id: 'issue-1' }]; },
    stockIssue: { findUnique: async () => {
      order.push('source');
      return { id: 'issue-1', status: 'APPROVED', projectId: 'project-1', storeId: 'store-1', items: [{ itemId: 'item-1', quantity: 5 }] };
    } },
    projectMaterialReturn: {
      findMany: async () => { order.push('prior'); return [{ items: [{ itemId: 'item-1', quantity: 3 }] }]; },
      create: async ({ data }: any) => { order.push('create'); created = data; return data; },
    },
  });
  const base = { projectId: 'project-1', storeId: 'store-1', issueId: 'issue-1', userId: 'user-1', items: [{ itemId: 'item-1', quantity: 2 }] };
  await ProjectStockIssueService.createReturnRequest(base);
  assert.deepEqual(order, ['lock', 'source', 'prior', 'create']);
  assert.equal(created.issueId, 'issue-1');

  order.length = 0;
  await assert.rejects(
    ProjectStockIssueService.createReturnRequest({ ...base, items: [{ itemId: 'item-1', quantity: 2.0001 }] }),
    /RETURN_EXCEEDS_SOURCE_ISSUE_QUANTITY/,
  );
  assert.deepEqual(order, ['lock', 'source', 'prior']);
});

it('rejects self-approval of a material return regardless of legacy display role', async () => {
  db.projectMaterialReturn.findUnique = async () => ({
    id: 'return-1', issueId: 'issue-1', status: 'PENDING', storeId: 'store-1', returnedById: 'user-1', items: [],
  });
  db.user.findUnique = async () => ({ id: 'user-1' });
  StoreService.assertStoreWriteAccess = async () => {};
  db.$transaction = async () => { throw new Error('transaction must not start'); };

  await assert.rejects(
    ProjectStockIssueService.approveReturnRequest('return-1', 'user-1'),
    /SEGREGATION_OF_DUTIES_VIOLATION/,
  );
});

it('audits a damaged return without replenishing stock or crediting project cost', async () => {
  db.projectMaterialReturn.findUnique = async () => ({
    id: 'return-2', issueId: 'issue-1', projectId: 'project-1', status: 'PENDING', storeId: 'store-1',
    returnNumber: 'MRN-2026-10-0001', returnedById: 'user-1',
    items: [{ id: 'line-1', itemId: 'item-1', quantity: 2, condition: 'DAMAGED' }],
  });
  db.user.findUnique = async () => ({ id: 'user-2' });
  StoreService.assertStoreWriteAccess = async () => {};

  const ledgerEntries: any[] = [];
  const transactions: any[] = [];
  let boqWrites = 0;
  let projectUpdate: any;
  AuditLedgerService.recordEntry = async (entry: any) => { ledgerEntries.push(entry); return {} as any; };
  db.$transaction = async (callback: (tx: any) => Promise<unknown>) => callback({
    projectMaterialReturn: { updateMany: async () => ({ count: 1 }) },
    inventoryStock: { findUnique: async () => ({ quantity: 7 }) },
    inventoryItem: { findUnique: async () => ({ unitPrice: 50 }) },
    projectBOQItem: { findFirst: async () => { boqWrites++; return null; }, update: async () => { boqWrites++; } },
    inventoryTransaction: { create: async (args: any) => { transactions.push(args.data); } },
    project: {
      findUnique: async () => ({ actualCost: 300, budget: 1000 }),
      update: async ({ data }: any) => { projectUpdate = data; },
    },
  });

  await ProjectStockIssueService.approveReturnRequest('return-2', 'user-2');
  assert.equal(boqWrites, 0);
  assert.equal(projectUpdate.actualCost, 300);
  assert.equal(ledgerEntries.length, 1);
  assert.equal(ledgerEntries[0].transactionType, 'WASTAGE_ADJUSTMENT');
  assert.equal(ledgerEntries[0].referenceId, 'MRN-2026-10-0001');
  assert.equal(ledgerEntries[0].quantityChange, 0);
  assert.equal(transactions[0].type, 'WASTAGE');
});
