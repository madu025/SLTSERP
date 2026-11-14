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
