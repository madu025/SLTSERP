import assert from 'node:assert/strict';
import { afterEach, mock, test } from 'node:test';
import { prisma } from '../../src/lib/prisma';
import { FixedAssetService } from '../../src/services/finance/fixed-asset.service';
import { PeriodCloseService } from '../../src/services/finance/period-close.service';
import { FiscalPeriodService } from '../../src/services/finance/fiscal-period.service';
import { LedgerReportService } from '../../src/services/finance/ledger-report.service';
import { LedgerService } from '../../src/services/finance/ledger.service';

/* eslint-disable @typescript-eslint/no-explicit-any -- deterministic transactional QA adapter. */
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

test('fixed asset depreciation to GL and year-end close completes 10 batches', async () => {
  let activeBatch = 0;
  let activeAsset: any;
  const ledgerEvents: Array<{ referenceType: string; amount: number }> = [];
  const lockedPeriods: string[] = [];

  const tx = {
    fixedAsset: {
      findMany: async () => activeAsset ? [activeAsset] : [],
      update: async ({ data }: any) => { Object.assign(activeAsset, data); return activeAsset; },
    },
    depreciationLog: {
      findMany: async () => [],
      create: async ({ data }: any) => ({ id: `dep-log-${activeBatch}`, ...data }),
    },
    journalEntry: {
      findUnique: async () => null,
      count: async () => 0,
    },
    fiscalPeriod: {
      count: async () => 0,
    },
  };

  stub(prisma, '$transaction', async (callback: (client: typeof tx) => unknown) => callback(tx));
  stub(prisma.fixedAsset, 'create', async ({ data }: any) => ({ id: `asset-${activeBatch}`, createdAt: new Date(), ...data }));
  mock.method(FiscalPeriodService, 'assertPeriodOpen', async () => undefined);
  mock.method(FiscalPeriodService, 'setPeriodStatus', async (year: number, month: number) => {
    lockedPeriods.push(`${year}-${month}`);
  });
  mock.method(LedgerReportService, 'getAccountBalances', async () => ({
    isBalanced: true,
    accounts: [
      { code: 'REV-4000', type: 'REVENUE', netBalance: 100 },
      { code: 'EXP-5000', type: 'EXPENSE', netBalance: 20 },
    ],
  }));
  mock.method(LedgerService, 'postTransaction', async (_tx: unknown, event: any) => {
    const amount = event.referenceType === 'FIXED_ASSET_DEPRECIATION'
      ? event.lines[0].debit
      : event.lines.reduce((sum: number, line: any) => sum + Number(line.debit || 0), 0);
    ledgerEvents.push({ referenceType: event.referenceType, amount });
    return { id: `journal-${activeBatch}` };
  });

  for (activeBatch = 1; activeBatch <= 10; activeBatch += 1) {
    const year = 2010 + activeBatch;
    activeAsset = await FixedAssetService.createAsset({
      assetNumber: `FA-QA-${String(activeBatch).padStart(3, '0')}`,
      name: `QA Asset ${activeBatch}`,
      cost: 1200,
      usefulLifeYears: 5,
      acquisitionDate: new Date(year, 0, 1),
    });
    assert.equal(activeAsset.status, 'ACTIVE');
    assert.equal(activeAsset.netBookValue, 1200);

    const depreciation = await FixedAssetService.runMonthlyDepreciation(year, 1, 'finance-checker');
    assert.equal(depreciation.logsCount, 1);
    assert.equal(depreciation.batchDepreciationTotal, 20);
    assert.equal(activeAsset.accumulatedDepreciation, 20);
    assert.equal(activeAsset.netBookValue, 1180);

    const close = await PeriodCloseService.executeYearEndClose(year, 'finance-checker');
    assert.equal(close.netProfit, 80);
    assert.equal(close.totalRevenue, 100);
    assert.equal(close.totalExpense, 20);
  }

  assert.equal(ledgerEvents.filter((event) => event.referenceType === 'FIXED_ASSET_DEPRECIATION').length, 10);
  assert.equal(ledgerEvents.filter((event) => event.referenceType === 'YEAR_END_CLOSE').length, 10);
  assert.equal(lockedPeriods.length, 120);
});

