/* eslint-disable @typescript-eslint/no-explicit-any -- Focused Prisma stubs verify reconciliation status semantics. */
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { prisma } from '../../src/lib/prisma';
import { BankCashService } from '../../src/services/finance/bank-cash.service';

const db = prisma as any;
const original = {
  bankFindUnique: db.bankAccount.findUnique,
  statementFindMany: db.bankStatementLine.findMany,
  journalFindMany: db.journalLine.findMany,
};
afterEach(() => {
  db.bankAccount.findUnique = original.bankFindUnique;
  db.bankStatementLine.findMany = original.statementFindMany;
  db.journalLine.findMany = original.journalFindMany;
});

test('matching balances do not hide unmatched statement or GL lines', async () => {
  db.bankAccount.findUnique = async () => ({ id: 'bank-1', accountNumber: '001', bankName: 'Bank', openingBalance: 0, glAccountCode: 'BANK-1000' });
  db.bankStatementLine.findMany = async () => [{ id: 'statement-1', debit: { toNumber: () => 100 }, credit: { toNumber: () => 0 }, isReconciled: false, reconciledJournalLineId: null }];
  let journalWhere: any;
  db.journalLine.findMany = async ({ where }: any) => {
    journalWhere = where;
    return [{ id: 'line-1', debit: 100, credit: 0 }];
  };
  const summary = await BankCashService.getBankReconciliationSummary('bank-1');
  assert.equal(summary.variance, 0);
  assert.equal(summary.isReconciled, false);
  assert.equal(summary.unreconciledStatementCount, 1);
  assert.equal(summary.unreconciledGlCount, 1);
  assert.deepEqual(journalWhere.entry, { status: 'POSTED' });
});

test('reconciliation is complete only when balances and line links match', async () => {
  db.bankAccount.findUnique = async () => ({ id: 'bank-1', accountNumber: '001', bankName: 'Bank', openingBalance: 0, glAccountCode: 'BANK-1000' });
  db.bankStatementLine.findMany = async () => [{ id: 'statement-1', debit: { toNumber: () => 100 }, credit: { toNumber: () => 0 }, isReconciled: true, reconciledJournalLineId: 'line-1' }];
  db.journalLine.findMany = async () => [{ id: 'line-1', debit: 100, credit: 0 }];
  const summary = await BankCashService.getBankReconciliationSummary('bank-1');
  assert.equal(summary.isReconciled, true);
  assert.equal(summary.unreconciledStatementCount, 0);
  assert.equal(summary.unreconciledGlCount, 0);
});

test('empty bank statements are not reported as reconciled', async () => {
  db.bankAccount.findUnique = async () => ({ id: 'bank-1', accountNumber: '001', bankName: 'Bank', openingBalance: 0, glAccountCode: 'BANK-1000' });
  db.bankStatementLine.findMany = async () => [];
  db.journalLine.findMany = async () => [];
  const summary = await BankCashService.getBankReconciliationSummary('bank-1');
  assert.equal(summary.variance, 0);
  assert.equal(summary.isReconciled, false);
});
