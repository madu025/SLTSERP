import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { scoreContractor, monthRange, SCORE_WEIGHTS, MIN_ORDERS_FOR_RANKING, type ContractorMonthMetrics } from '../../src/lib/contractor-scorecard-shared';

const m = (over: Partial<ContractorMonthMetrics> = {}): ContractorMonthMetrics =>
  ({ completed: 100, withinSla: 90, patPassed: 95, patFailed: 5, returned: 0, activeDays: 20, teams: 2, ...over });

test('score weights sum to 100', () => {
  assert.equal(Object.values(SCORE_WEIGHTS).reduce((a, b) => a + b, 0), 100);
});

test('a strong contractor scores high and every component is reported', () => {
  const s = scoreContractor(m({ completed: 80, withinSla: 80, patPassed: 100, patFailed: 0, returned: 0, activeDays: 20, teams: 2 }));
  assert.equal(s.slaPct, 100);
  assert.equal(s.patPassPct, 100);
  assert.equal(s.returnRatePct, 0);
  assert.equal(s.perTeamDay, 2);
  assert.equal(s.score, 100);
  assert.equal(s.lowVolume, false);
});

test('returns erode the score and 20% returns zeroes that component', () => {
  const none = scoreContractor(m({ returned: 0 }));
  const some = scoreContractor(m({ completed: 80, returned: 20 })); // 20% of 100 handled
  assert.equal(some.returnRatePct, 20);
  assert.equal(some.components.returns, 0);
  assert.ok((some.score ?? 0) < (none.score ?? 0));
});

test('components without data are left out and the rest re-weighted, never counted as zero', () => {
  // no PAT decisions, no activity days -> only SLA and returns remain
  const s = scoreContractor({ completed: 10, withinSla: 10, patPassed: 0, patFailed: 0, returned: 0, activeDays: 0, teams: 0 });
  assert.equal(s.patPassPct, null);
  assert.equal(s.perTeamDay, null);
  assert.deepEqual(Object.keys(s.components).sort(), ['returns', 'sla']);
  assert.equal(s.score, 100);
  // nothing at all -> no score rather than 0
  const empty = scoreContractor({ completed: 0, withinSla: 0, patPassed: 0, patFailed: 0, returned: 0, activeDays: 0, teams: 0 });
  assert.equal(empty.score, null);
});

test('low volume is flagged below the ranking minimum', () => {
  assert.equal(scoreContractor(m({ completed: MIN_ORDERS_FOR_RANKING - 1, withinSla: 1 })).lowVolume, true);
  assert.equal(scoreContractor(m({ completed: MIN_ORDERS_FOR_RANKING })).lowVolume, false);
});

test('productivity is per team per active day and capped at full marks', () => {
  assert.equal(scoreContractor(m({ completed: 40, activeDays: 20, teams: 1 })).perTeamDay, 2);
  assert.equal(scoreContractor(m({ completed: 40, activeDays: 20, teams: 4 })).perTeamDay, 0.5);
  assert.equal(scoreContractor(m({ completed: 400, activeDays: 20, teams: 1 })).components.productivity, 100);
});

test('month range is oldest first and crosses year ends', () => {
  assert.deepEqual(monthRange('2026-02', 4), ['2025-11', '2025-12', '2026-01', '2026-02']);
  assert.deepEqual(monthRange('2026-11', 1), ['2026-11']);
});

test('scorecard service and API are scoped, cached nowhere stale, and the page is client-safe', () => {
  const svc = fs.readFileSync('src/services/contractor/contractor-scorecard.service.ts', 'utf8');
  assert.match(svc, /resolveOpmcScope\(userId\)/);
  assert.match(svc, /SOD_TURNAROUND_SLA_DAYS/);
  assert.doesNotMatch(svc, /ContractorPerformanceScore/, 'never touches the project-based score table');
  const route = fs.readFileSync('src/app/api/contractors/scorecard/route.ts', 'utf8');
  assert.match(route, /CONTRACTOR_READ/);
  const page = fs.readFileSync('src/app/contractors/scorecard/page.tsx', 'utf8');
  assert.doesNotMatch(page, /@\/services\//);
  const health = fs.readFileSync('src/services/core/company-health.service.ts', 'utf8');
  assert.ok(health.includes('`ops-contractor-${r.contractorId}`'));
  assert.match(health, /!r\.current\.lowVolume/, 'thin-volume contractors are never flagged');
});
