import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';

import { prisma } from '../../../src/lib/prisma';
import {
  calculateProjectCostSummary,
} from '../../../src/services/finance/budget-tracking.service';
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

afterEach(() => {
  db.$transaction = originalTransaction;
  db.projectExpense.findMany = originalFindMany;
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
      },
      project: {
        findUnique: async () => ({ actualCost: 125.5, budget: 500 }),
        update: async () => ({ id: 'project-1' }),
      },
      stockIssue: { findFirst: async () => null },
    });

    const result = await ProjectExpenseService.voidExpense('expense-1', 'user-1');

    assert.equal(result.success, true);
    assert.equal(updateData?.amount, 0);
    assert.match(String(updateData?.remarks), /\[VOIDED .* by user-1\] Original amount: 25\.50\./);
  });

  it('does not publish an expense-only project total when material cost is unknown', async () => {
    let projectUpdated = false;

    db.$transaction = async (callback) => callback({
      projectExpense: { create: async () => ({ id: 'expense-1' }) },
      project: {
        findUnique: async () => ({ actualCost: 100, budget: 500 }),
        update: async () => {
          projectUpdated = true;
          return { id: 'project-1' };
        },
      },
      stockIssue: { findFirst: async () => ({ id: 'issue-1' }) },
    });

    await ProjectExpenseService.createExpense({
      projectId: 'project-1',
      type: 'MISC',
      amount: 25,
    });

    assert.equal(projectUpdated, false);
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
