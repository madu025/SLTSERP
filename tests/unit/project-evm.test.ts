import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { elapsedFraction, plannedPercent, computeEvm, SPI_ALERT_THRESHOLD, type EvmTask } from '../../src/lib/project-evm';
import { colomboDay } from '../../src/services/project/project-evm-snapshot.service';

const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

test('elapsed fraction clamps to the window and handles zero-length windows', () => {
  assert.equal(elapsedFraction(d('2026-01-01'), d('2026-01-11'), d('2025-12-01')), 0);
  assert.equal(elapsedFraction(d('2026-01-01'), d('2026-01-11'), d('2026-01-06')), 0.5);
  assert.equal(elapsedFraction(d('2026-01-01'), d('2026-01-11'), d('2026-06-01')), 1);
  assert.equal(elapsedFraction(d('2026-01-05'), d('2026-01-05'), d('2026-01-04')), 0);
  assert.equal(elapsedFraction(d('2026-01-05'), d('2026-01-05'), d('2026-01-05')), 1);
});

test('planned percent: s-curve over weighted tasks, then project dates, then null', () => {
  const now = d('2026-01-11');
  const tasks: EvmTask[] = [
    { plannedStart: d('2026-01-01'), plannedEnd: d('2026-01-11'), estimatedCost: 300, plannedDurationDays: 10 }, // done (1.0)
    { plannedStart: d('2026-01-11'), plannedEnd: d('2026-01-21'), estimatedCost: 700, plannedDurationDays: 10 }, // not started (0)
  ];
  // cost weights: 300 done of 1000 => 30%
  assert.equal(plannedPercent(tasks, { startDate: null, endDate: null }, now), 30);
  // no costs -> duration weights: equal => 50%
  assert.equal(plannedPercent(tasks.map((t) => ({ ...t, estimatedCost: null })), { startDate: null, endDate: null }, now), 50);
  // neither -> equal weights
  assert.equal(plannedPercent(tasks.map((t) => ({ ...t, estimatedCost: null, plannedDurationDays: null })), { startDate: null, endDate: null }, now), 50);
  // no dated tasks -> straight line over the project dates
  assert.equal(plannedPercent([], { startDate: d('2026-01-01'), endDate: d('2026-01-21') }, now), 50);
  assert.equal(plannedPercent([{ plannedStart: null, plannedEnd: null, estimatedCost: 5, plannedDurationDays: 3 }], { startDate: d('2026-01-01'), endDate: d('2026-01-21') }, now), 50);
  // nothing to measure against
  assert.equal(plannedPercent([], { startDate: null, endDate: null }, now), null);
});

test('earned value: SPI/CPI/EAC from real inputs, and no made-up figures when inputs are missing', () => {
  // 1,000,000 budget, 40% planned, 30% done, 450,000 spent
  const r = computeEvm({ bac: 1_000_000, progressPct: 30, plannedPct: 40, actualCost: 450_000 });
  assert.equal(r.pv, 400_000);
  assert.equal(r.ev, 300_000);
  assert.equal(r.spi, 0.75);
  assert.equal(r.cpi, 0.6667);
  assert.equal(r.sv, -100_000);
  assert.equal(r.cv, -150_000);
  assert.equal(r.eac, 1_500_000, 'EAC = BAC / CPI');
  assert.equal(r.status, 'RED');
  assert.deepEqual(r.gaps, []);

  // on plan and on cost
  const ok = computeEvm({ bac: 1000, progressPct: 50, plannedPct: 50, actualCost: 500 });
  assert.equal(ok.spi, 1);
  assert.equal(ok.cpi, 1);
  assert.equal(ok.status, 'GREEN');
  assert.equal(ok.vac, 0);

  // amber band
  assert.equal(computeEvm({ bac: 1000, progressPct: 47, plannedPct: 50, actualCost: 470 }).status, 'AMBER');

  // missing schedule / cost are reported as gaps, never as 0 or 1
  const none = computeEvm({ bac: 1000, progressPct: 20, plannedPct: null, actualCost: null });
  assert.equal(none.pv, null);
  assert.equal(none.spi, null);
  assert.equal(none.cpi, null);
  assert.equal(none.eac, 1000, 'without CPI the estimate falls back to the budget');
  assert.equal(none.gaps.length, 2);
  assert.equal(none.status, 'GREEN', 'unknown is not treated as bad');

  // no budget
  const nobudget = computeEvm({ bac: 0, progressPct: 50, plannedPct: 50, actualCost: 10 });
  assert.equal(nobudget.eac, null);
  assert.ok(nobudget.gaps.some((g) => /No budget/.test(g)));
  // progress is clamped
  assert.equal(computeEvm({ bac: 100, progressPct: 250, plannedPct: 100, actualCost: 100 }).ev, 100);
});

test('snapshots are keyed per Colombo day and the job never overwrites manual rows', () => {
  assert.equal(colomboDay(new Date('2026-11-14T20:00:00Z')), '2026-11-15', '20:00 UTC is already the next day in Colombo');
  assert.equal(colomboDay(new Date('2026-11-14T10:00:00Z')), '2026-11-14');
  const svc = fs.readFileSync('src/services/project/project-evm-snapshot.service.ts', 'utf8');
  assert.match(svc, /sourceBy\.get\(p\.id\) === 'MANUAL'/);
  assert.match(svc, /evmId_periodLabel/);
  const manual = fs.readFileSync('src/services/project/project-evm.service.ts', 'utf8');
  assert.equal((manual.match(/source: 'MANUAL'/g) ?? []).length, 2, 'both update and create mark manual entries');
});

test('daily EVM job runs before project reminders and is registered everywhere', () => {
  const sync = fs.readFileSync('src/services/service-order/sod.sync.service.ts', 'utf8');
  assert.match(sync, /name: 'evm-snapshot', type: 'EVM_SNAPSHOT', at: '07:20'/);
  assert.match(sync, /if \(type === 'EVM_SNAPSHOT'\)/);
  assert.match(fs.readFileSync('src/services/service-order/sync/types.ts', 'utf8'), /'EVM_SNAPSHOT'/);
  assert.match(fs.readFileSync('src/workers/system.worker.ts', 'utf8'), /EVM_SNAPSHOT: async/);
  const mig = fs.readFileSync('prisma/migrations/20261124000000_evm_auto_snapshots/migration.sql', 'utf8');
  assert.match(mig, /DELETE FROM "EVMSnapshot"/, 'duplicates are collapsed before the unique index');
  assert.match(mig, /CREATE UNIQUE INDEX IF NOT EXISTS "EVMSnapshot_evmId_periodLabel_key"/);
});

test('project health alerts: weekly dedup, one audience, notification only; KPI no longer uses the progress+10% fudge', () => {
  const rem = fs.readFileSync('src/services/project/project-deadline-reminder.service.ts', 'utf8');
  assert.match(rem, /dedupKey: `project-health:\$\{kind\}:\$\{p\.id\}:\$\{week\}`/);
  for (const k of ["'overdue'", "'overrun'", "'spi'", "'untracked'"]) assert.ok(rem.includes(k), k);
  assert.match(fs.readFileSync('src/services/notification/reminder-scheduler.service.ts', 'utf8'), /remindProjectHealth/);
  const kpi = fs.readFileSync('src/services/project/project-kpi.service.ts', 'utf8');
  assert.doesNotMatch(kpi, /progress \+ 0\.1/);
  assert.match(kpi, /computeEvm/);
  assert.equal(SPI_ALERT_THRESHOLD, 0.85);
});
