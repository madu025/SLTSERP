import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { compare, monthBounds } from '../../src/services/core/company-health.service';

test('compare gives a percentage change and no fake base when the previous value is zero', () => {
  assert.equal(compare(150, 100).changePct, 50);
  assert.equal(compare(50, 100).changePct, -50);
  assert.equal(compare(10, 0).changePct, null);
  assert.equal(compare(-50, -100).changePct, 50);
});

test('monthBounds returns the current and previous calendar month in UTC', () => {
  const b = monthBounds(new Date('2026-01-15T10:00:00Z'));
  assert.equal(b.currentStart.toISOString(), '2026-01-01T00:00:00.000Z');
  assert.equal(b.previousStart.toISOString(), '2025-12-01T00:00:00.000Z');
  assert.equal(b.previousEnd.toISOString(), '2025-12-31T23:59:59.999Z');
  assert.equal(b.yearStart.toISOString(), '2026-01-01T00:00:00.000Z');
  // 14.4 days into January -> the comparison window is the first 14.4 days of December
  assert.equal(b.previousSameSpanEnd.toISOString(), '2025-12-15T10:00:00.000Z');
  // late in a long month the window is capped at the end of the previous (shorter) month
  const feb = monthBounds(new Date('2026-03-31T00:00:00Z'));
  assert.equal(feb.previousSameSpanEnd.toISOString(), feb.previousEnd.toISOString());
});

test('company health endpoint is management-only and sections are gated per module capability', () => {
  const route = fs.readFileSync('src/app/api/dashboard/company-health/route.ts', 'utf8');
  assert.match(route, /REPORTS_MANAGER_READ/);
  assert.match(route, /ADMIN_RBAC/);
  const svc = fs.readFileSync('src/services/core/company-health.service.ts', 'utf8');
  for (const p of ['FINANCE_READ', 'SOD_READ', 'PROJECT_READ', 'FLEET_READ', 'HELPDESK_READ', 'INVENTORY_READ']) {
    assert.ok(svc.includes(`has(RBAC_PERMISSIONS.${p})`), p);
  }
});

test('management alerts run daily, are wired end to end, and are de-duplicated per exception per day', () => {
  const svc = fs.readFileSync('src/services/notification/management-alerts.service.ts', 'utf8');
  assert.match(svc, /audience: 'ADMINISTRATORS'/);
  assert.match(svc, /dedupKey: `management-alert:\$\{e\.id\}:\$\{day\(now\)\}`/);
  assert.match(svc, /severity !== 'info'/);
  assert.match(fs.readFileSync('src/services/service-order/sync/types.ts', 'utf8'), /'MANAGEMENT_ALERTS'/);
  assert.match(fs.readFileSync('src/services/service-order/sod.sync.service.ts', 'utf8'), /name: 'management-alerts', type: 'MANAGEMENT_ALERTS', at: '07:45'/);
  assert.match(fs.readFileSync('src/workers/system.worker.ts', 'utf8'), /MANAGEMENT_ALERTS: async/);
});

test('FP&A classifies accounts from the chart of accounts, not numeric code prefixes', async () => {
  const { classifyAccount, periodBounds, previousPeriod } = await import('../../src/services/finance/fpa-dashboard.service');
  assert.equal(classifyAccount('REV-4010', 'REVENUE'), 'REVENUE');
  assert.equal(classifyAccount('COGS-5010', 'EXPENSE'), 'DIRECT_COST');
  assert.equal(classifyAccount('EXP-CON-4020', 'EXPENSE'), 'DIRECT_COST');
  assert.equal(classifyAccount('EXP-STAFF-6010', 'EXPENSE'), 'OPEX');
  assert.equal(classifyAccount('AR-1110', 'ASSET'), 'OTHER');
  assert.equal(classifyAccount('UNKNOWN', undefined), 'OTHER');
  assert.equal(periodBounds(2026, 4).end.toISOString(), '2026-12-31T23:59:59.999Z');
  assert.equal(periodBounds(2026).name, '2026');
  assert.deepEqual(previousPeriod(2026, 1), { year: 2025, quarter: 4 });
  assert.deepEqual(previousPeriod(2026, 3), { year: 2026, quarter: 2 });
  assert.deepEqual(previousPeriod(2026), { year: 2025, quarter: undefined });
});

test('FP&A includes reversed originals so reversals net to zero', () => {
  const svc = fs.readFileSync('src/services/finance/fpa-dashboard.service.ts', 'utf8');
  assert.equal((svc.match(/status: \{ in: \['POSTED', 'REVERSED'\] \}/g) ?? []).length >= 1, true);
  assert.match(svc, /e\."status" IN \('POSTED', 'REVERSED'\)/);
});

test('cash forecast helpers: week bucketing, DSO and indicative credit loss', async () => {
  const { weekIndex, computeDso, expectedCreditLoss, ECL_RATES } = await import('../../src/services/finance/cash-forecast.service');
  const now = new Date('2026-11-14T00:00:00Z');
  const day = 24 * 3600 * 1000;
  assert.equal(weekIndex(new Date(now.getTime() - 1), now), 0, 'past due is overdue, not a forecast week');
  assert.equal(weekIndex(new Date(now.getTime() + 1 * day), now), 1);
  assert.equal(weekIndex(new Date(now.getTime() + 7 * day), now), 2);
  assert.equal(weekIndex(new Date(now.getTime() + 90 * day), now), 13);
  assert.equal(computeDso(500, 1000), 45);
  assert.equal(computeDso(500, 0), null);
  const ecl = expectedCreditLoss({ current: 1000, days31to60: 1000, days61to90: 1000, over90: 1000 });
  assert.equal(ecl, 1000 * (ECL_RATES.current + ECL_RATES.days31to60 + ECL_RATES.days61to90 + ECL_RATES.over90));
});

test('cash forecast API is finance-gated and the service enforces OPMC scope', () => {
  const route = fs.readFileSync('src/app/api/finance/cash-forecast/route.ts', 'utf8');
  assert.match(route, /FINANCE_READ/);
  const svc = fs.readFileSync('src/services/finance/cash-forecast.service.ts', 'utf8');
  assert.match(svc, /resolveOpmcScope\(userId\)/);
  assert.match(svc, /scope === undefined \? LedgerReportService\.getCashFlowReport/);
});

test('company health is company-wide: scoped users are refused and aging is explicitly unscoped, never "null user"', () => {
  const route = fs.readFileSync('src/app/api/dashboard/company-health/route.ts', 'utf8');
  assert.match(route, /resolveOpmcScope\(params\._userId\)/);
  assert.match(route, /scope !== undefined\) throw AppError\.forbidden/);
  const svc = fs.readFileSync('src/services/core/company-health.service.ts', 'utf8');
  assert.match(svc, /getArAgingReport\(null, \{ unscoped: true \}\)/);
  assert.doesNotMatch(svc, /getArAgingReport\(null\)/);
  const forecast = fs.readFileSync('src/services/finance/cash-forecast.service.ts', 'utf8');
  assert.equal((forecast.match(/status: \{ notIn: \['DRAFT', 'CANCELLED', 'REJECTED'\] \}/g) ?? []).length >= 2, true, 'drafts are not receivables');
});

test('report comparison windows: previous period is the equal-length window before, yoy is one year earlier', async () => {
  const { comparisonRange } = await import('../../src/services/finance/ledger-report.service');
  const from = new Date('2026-11-01T00:00:00.000Z');
  const to = new Date('2026-11-30T23:59:59.999Z');
  const prev = comparisonRange(from, to, 'previous');
  assert.equal(prev.from.toISOString(), '2026-10-02T00:00:00.000Z');
  assert.equal(prev.to.toISOString(), '2026-10-31T23:59:59.999Z');
  const yoy = comparisonRange(from, to, 'yoy');
  assert.equal(yoy.from.toISOString(), '2025-11-01T00:00:00.000Z');
  assert.equal(yoy.to.toISOString(), '2025-11-30T23:59:59.999Z');
  // windows never overlap the current one
  assert.ok(prev.to < from);
});

test('journal entry dimensions: schema, migration, posting and reversal all carry OPMC / project', () => {
  const schema = fs.readFileSync('prisma/schema/inventory.prisma', 'utf8');
  assert.match(schema, /opmcId\s+String\?\s+@db\.Uuid/);
  assert.match(schema, /@@index\(\[opmcId\]\)/);
  const mig = fs.readFileSync('prisma/migrations/20261121000000_journal_entry_dimensions/migration.sql', 'utf8');
  assert.match(mig, /ADD COLUMN IF NOT EXISTS "opmcId" UUID/);
  assert.match(mig, /"opmcId" IS NULL/); // idempotent backfill
  const ledger = fs.readFileSync('src/services/finance/ledger.service.ts', 'utf8');
  assert.match(ledger, /resolveEntryDimensions\(tx, payload\.referenceType, payload\.referenceId\)/);
  assert.match(ledger, /opmcId: original\.opmcId \?\? null/);
});

test('profitability report: scoped users never see company-level rows and reuse the FP&A classifier', async () => {
  const svc = fs.readFileSync('src/services/finance/profitability.service.ts', 'utf8');
  assert.match(svc, /resolveOpmcScope\(userId\)/);
  assert.match(svc, /k !== null \|\| scope === undefined/);
  assert.match(svc, /classifyAccount/);
  const { summarise } = await import('../../src/services/finance/profitability.service');
  const s = summarise(1000, 400, 100);
  assert.equal(s.grossMargin, 600);
  assert.equal(s.netProfit, 500);
  assert.equal(s.marginPct, 50);
  assert.equal(summarise(0, 10, 0).marginPct, null);
});

test('GL budgets: annual spreads exactly, variance sign is favourable-positive, overruns need a budget and tolerance', async () => {
  const { spreadAnnual, favourableVariance, expenseOverruns } = await import('../../src/services/finance/ledger-budget.service');
  const spread = spreadAnnual(1000);
  assert.equal(spread.length, 12);
  assert.equal(Math.round(spread.reduce((a, v) => a + v, 0) * 100), 100000, 'months add back to the annual amount to the cent');
  assert.equal(Math.round(spreadAnnual(100.01).reduce((a, v) => a + v, 0) * 100), 10001);
  assert.equal(favourableVariance('REVENUE', 100, 120), 20);
  assert.equal(favourableVariance('EXPENSE', 100, 120), -20);
  const row = (kind: 'REVENUE' | 'EXPENSE', ytdBudget: number, ytdActual: number) => ({
    accountCode: 'X', accountName: 'X', kind, annualBudget: 0, ytdBudget, ytdActual,
    variance: favourableVariance(kind, ytdBudget, ytdActual), variancePct: null, monthlyBudget: [], monthlyActual: [],
  });
  assert.equal(expenseOverruns([row('EXPENSE', 100, 105), row('EXPENSE', 100, 111), row('EXPENSE', 0, 50), row('REVENUE', 100, 500)]).length, 1);
});

test('budget API: reads need finance.read, writes need finance.write, and scope decides company-wide vs OPMC budgets', () => {
  const route = fs.readFileSync('src/app/api/finance/budget-vs-actual/route.ts', 'utf8');
  assert.match(route, /FINANCE_READ/);
  assert.match(route, /FINANCE_WRITE/);
  const svc = fs.readFileSync('src/services/finance/ledger-budget.service.ts', 'utf8');
  assert.match(svc, /resolveOpmcScope\(userId\)/);
  assert.match(svc, /Company-wide budgets are available only to users with company-wide access/);
  assert.match(svc, /deleteMany[\s\S]*createMany/);
});
