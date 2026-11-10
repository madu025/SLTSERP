import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';

import { prisma } from '../../../src/lib/prisma';
import {
  calculateProjectCostSummary,
} from '../../../src/services/finance/budget-tracking.service';
import { LedgerService } from '../../../src/services/finance/ledger.service';
import {
  parsePositiveExpenseAmount,
  ProjectExpenseService,
} from '../../../src/services/project/project-expense.service';

type PrismaStub = {
  $transaction: (callback: (tx: unknown) => Promise<unknown>) => Promise<unknown>;
  projectExpense: {
    findMany: (args: { where: Record<string, unknown> }) => Promise<unknown>;
  };
};

const db = prisma as unknown as PrismaStub;
const originalTransaction = db.$transaction;
const originalFindMany = db.projectExpense.findMany;
const originalLogExpense = LedgerService.logProjectExpense;
const originalReverseExpense = LedgerService.reverseProjectExpense;
const posted: Array<{ id: string; amount: number }> = [];
const reversed: string[] = [];

beforeEach(() => {
  posted.length = 0;
  reversed.length = 0;
  LedgerService.logProjectExpense = (async (_tx: unknown, id: string, amount: number) => { posted.push({ id, amount }); return null; }) as never;
  LedgerService.reverseProjectExpense = (async (_tx: unknown, id: string) => { reversed.push(id); return null; }) as never;
});

afterEach(() => {
  db.$transaction = originalTransaction;
  db.projectExpense.findMany = originalFindMany;
  LedgerService.logProjectExpense = originalLogExpense;
  LedgerService.reverseProjectExpense = originalReverseExpense;
});


// Minimal transaction client for the shared cost computation (expenses + labor + ledger-costed material)
const costTx = (opts: { issues?: Array<{ issueNumber: string }>; ledger?: unknown[]; expenseSum?: number; onProjectUpdate?: () => void } = {}) => ({
  stockIssue: { findMany: async () => opts.issues ?? [] },
  projectMaterialReturn: { findMany: async () => [] },
  inventoryLedger: { findMany: async () => opts.ledger ?? [] },
  projectExpense: { aggregate: async () => ({ _sum: { amount: opts.expenseSum ?? 0 } }) },
  dailyProgress: { aggregate: async () => ({ _sum: { laborCost: 0 } }) },
  project: {
    findUnique: async () => ({ actualCost: 100, budget: 500 }),
    update: async () => { opts.onProjectUpdate?.(); return { id: 'project-1' }; },
  },
});

describe('project cost integrity', () => {
  it('rejects zero, negative, non-finite, and partially numeric expense amounts', () => {
    for (const amount of [0, -1, '', '  ', '12.50abc', Number.NaN, Number.POSITIVE_INFINITY]) {
      assert.throws(() => parsePositiveExpenseAmount(amount), /EXPENSE_AMOUNT_MUST_BE_POSITIVE/);
    }

    assert.equal(parsePositiveExpenseAmount('12.50'), 12.5);
    assert.equal(parsePositiveExpenseAmount(1), 1);
  });

  it('fails closed when approved material issues have no immutable unit-cost mapping', () => {
    const summary = calculateProjectCostSummary({
      budget: 1_000,
      expenseCost: 125,
      laborCost: 300,
      hasApprovedMaterialIssues: true,
    });

    assert.equal(summary.materialCost, null);
    assert.equal(summary.actualCost, null);
    assert.equal(summary.variance, null);
    assert.equal(summary.variancePct, null);
    assert.equal(summary.actualCostStatus, 'MATERIAL_COST_UNKNOWN');
    assert.equal(summary.knownActualCost, 425);
  });

  it('calculates actual cost only when every included source has a monetary value', () => {
    const summary = calculateProjectCostSummary({
      budget: 1_000,
      expenseCost: 125,
      laborCost: 300,
      hasApprovedMaterialIssues: false,
    });

    assert.equal(summary.materialCost, 0);
    assert.equal(summary.actualCost, 425);
    assert.equal(summary.variance, 575);
    assert.equal(summary.varianceStatus, 'UNDER');
  });

  it('voids an expense with an immutable-on-record note instead of deleting it', async () => {
    let updateData: Record<string, unknown> | undefined;

    db.$transaction = async (callback) => callback({
      ...costTx({ expenseSum: 100 }),
      projectExpense: {
        findUnique: async () => ({
          id: 'expense-1',
          projectId: 'project-1',
          amount: { toString: () => '25.50' },
          remarks: 'Original entry',
        }),
        update: async ({ data }: { data: Record<string, unknown> }) => {
          updateData = data;
          return { id: 'expense-1' };
        },
        aggregate: async () => ({ _sum: { amount: 100 } }),
      },
    });

    const result = await ProjectExpenseService.voidExpense('expense-1', 'user-1');

    assert.equal(result.success, true);
    assert.equal(updateData?.amount, 0);
    assert.deepEqual(reversed, ['expense-1'], 'the expense journal entry is reversed on void');
    assert.match(String(updateData?.remarks), /\[VOIDED .* by user-1\] Original amount: 25\.50\./);
  });

  it('does not publish an expense-only project total when material cost is unknown', async () => {
    let projectUpdated = false;

    db.$transaction = async (callback) => callback({
      ...costTx({ issues: [{ issueNumber: 'ISS-1' }], ledger: [], onProjectUpdate: () => { projectUpdated = true; } }),
      projectExpense: { create: async () => ({ id: 'expense-1' }), aggregate: async () => ({ _sum: { amount: 25 } }) },
    });

    await ProjectExpenseService.createExpense({
      projectId: 'project-1',
      type: 'MISC',
      amount: 25,
    });

    assert.equal(projectUpdated, false);
  });

  it('includes ledger-costed material (batch cost) in the stored project total', async () => {
    let stored: Record<string, unknown> | undefined;
    const tx = costTx({
      issues: [{ issueNumber: 'ISS-1' }],
      ledger: [{ transactionType: 'PROJECT_ISSUE', referenceId: 'ISS-1', quantityChange: -10, unitPrice: 3000 }],
      expenseSum: 2000,
    });
    tx.project.update = (async ({ data }: { data: Record<string, unknown> }) => { stored = data; return { id: 'project-1' }; }) as never;
    db.$transaction = async (callback) => callback({ ...tx, projectExpense: { create: async () => ({ id: 'e' }), aggregate: async () => ({ _sum: { amount: 2000 } }) } });

    await ProjectExpenseService.createExpense({ projectId: 'project-1', type: 'MISC', amount: 2000 });

    // 10 x 3000 material + 2000 expense, never the BOQ selling rate
    assert.deepEqual(posted, [{ id: 'e', amount: 2000 }], 'the expense is posted to the general ledger');
    assert.equal(stored?.actualCost, 32000);
    assert.equal(stored?.variance, 500 - 32000);
  });

  it('hides retained void records from the active-expense read model', async () => {
    let where: Record<string, unknown> | undefined;

    db.projectExpense.findMany = async ({ where: queryWhere }) => {
      where = queryWhere;
      return [];
    };

    await ProjectExpenseService.getExpenses('project-1');

    assert.deepEqual(where, { projectId: 'project-1', amount: { gt: 0 } });
  });
});
