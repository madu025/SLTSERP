import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { ageBucket, slaPct, daysToClear, emptyBuckets, AGE_BUCKETS } from '../../src/lib/sod-performance-shared';
import { SOD_TURNAROUND_SLA_DAYS, SOD_OPEN_SLTS_STATUSES, SOD_FINANCIAL_COMPLETION_STATUSES } from '../../src/lib/constants/sod-constants';

test('age buckets: boundaries land in the right bucket and cover every age', () => {
  assert.equal(ageBucket(0), '0-3');
  assert.equal(ageBucket(2.99), '0-3');
  assert.equal(ageBucket(3), '3-7');
  assert.equal(ageBucket(6.9), '3-7');
  assert.equal(ageBucket(7), '7-14');
  assert.equal(ageBucket(13.99), '7-14');
  assert.equal(ageBucket(14), '14-30');
  assert.equal(ageBucket(29.9), '14-30');
  assert.equal(ageBucket(30), '30+');
  assert.equal(ageBucket(400), '30+');
  assert.deepEqual(Object.keys(emptyBuckets()), [...AGE_BUCKETS]);
});

test('SLA percentage and days-to-clear handle empty and zero-output cases without fake numbers', () => {
  assert.equal(slaPct(50, 100), 50);
  assert.equal(slaPct(1, 3), 33.3);
  assert.equal(slaPct(0, 0), null, 'no completed orders means no percentage, not 0%');
  assert.equal(daysToClear(0, 0), 0, 'nothing open is already clear');
  assert.equal(daysToClear(28, 14), 28, '1 per day, 28 open');
  assert.equal(daysToClear(10, 28), 5, '2 per day, 10 open');
  assert.equal(daysToClear(9, 0), null, 'backlog with no recent output cannot be cleared at the current rate');
});

test('one shared SLA definition and status groups', () => {
  assert.equal(SOD_TURNAROUND_SLA_DAYS, 7);
  assert.deepEqual([...SOD_OPEN_SLTS_STATUSES].sort(), ['ASSIGNED', 'INPROGRESS']);
  assert.ok(SOD_FINANCIAL_COMPLETION_STATUSES.includes('COMPLETED' as never));
  for (const f of ['src/services/service-order/sod-performance.service.ts', 'src/services/core/company-health.service.ts']) {
    assert.match(fs.readFileSync(f, 'utf8'), /SOD_TURNAROUND_SLA_DAYS/, f);
  }
});

test('SOD performance: scoped, bad-date-safe, aggregate-only and client-safe', () => {
  const svc = fs.readFileSync('src/services/service-order/sod-performance.service.ts', 'utf8');
  assert.match(svc, /resolveOpmcScope\(userId\)/);
  assert.match(svc, /"completedDate" >= so\."receivedDate"/, 'completion before receipt is excluded from turnaround');
  assert.match(svc, /percentile_cont\(0\.5\)/);
  assert.match(svc, /percentile_cont\(0\.9\)/);
  assert.doesNotMatch(svc, /findMany/, 'aggregates only, never row-by-row over ~100k orders');
  const page = fs.readFileSync('src/app/service-orders/performance/page.tsx', 'utf8');
  assert.doesNotMatch(page, /@\/services\//, 'client page must not import server services (would bundle Prisma)');
  const route = fs.readFileSync('src/app/api/service-orders/performance/route.ts', 'utf8');
  assert.match(route, /SOD_READ/);
  assert.match(route, /MAX_WINDOW_DAYS/);
});

test('company health reports SLA and ageing RTOMs as operations exceptions', () => {
  const svc = fs.readFileSync('src/services/core/company-health.service.ts', 'utf8');
  for (const id of ["'ops-sla'", '`ops-rtom-${r.rtom}`']) assert.ok(svc.includes(id), id);
  assert.match(svc, /slaPct30d < 75/);
});
