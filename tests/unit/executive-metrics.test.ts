import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { ExecutiveMetricService, resolvePeriod, METRIC_IDS } from '../../src/services/ai/executive-metrics.service';

const NOW = new Date('2026-11-17T10:00:00Z');

test('this month compares the same number of days of the previous month', () => {
    const p = resolvePeriod('this_month', NOW);
    assert.equal(p.from.toISOString(), '2026-11-01T00:00:00.000Z');
    assert.equal(p.prevFrom.toISOString(), '2026-10-01T00:00:00.000Z');
    // 16 days 10 hours into November -> the same span into October
    assert.equal(p.prevTo.toISOString(), '2026-10-17T10:00:00.000Z');
});

test('last month compares with the month before it', () => {
    const p = resolvePeriod('last_month', NOW);
    assert.equal(p.from.toISOString(), '2026-10-01T00:00:00.000Z');
    assert.equal(p.to.toISOString().slice(0, 10), '2026-10-31');
    assert.equal(p.prevFrom.toISOString(), '2026-09-01T00:00:00.000Z');
    assert.equal(p.prevTo.toISOString().slice(0, 10), '2026-09-30');
});

test('rolling windows compare with the equal window before them', () => {
    const p = resolvePeriod('last_7_days', NOW);
    assert.equal(p.to.getTime() - p.from.getTime(), 7 * 24 * 3600 * 1000);
    assert.equal(p.prevTo.getTime() + 1, p.from.getTime());
    const w = resolvePeriod('this_week', NOW); // 17 Nov 2026 is a Tuesday
    assert.equal(w.from.toISOString(), '2026-11-16T00:00:00.000Z');
    assert.equal(w.prevFrom.toISOString(), '2026-11-09T00:00:00.000Z');
});

test('metrics need their module permission and company-wide ones refuse OPMC-scoped users', () => {
    assert.deepEqual(ExecutiveMetricService.allowed('completed_orders', new Set(['sod.read']), undefined), { ok: true });
    const noPerm = ExecutiveMetricService.allowed('completed_orders', new Set(), undefined);
    assert.equal(noPerm.ok, false);
    const scopedFinance = ExecutiveMetricService.allowed('revenue', new Set(['finance.read']), ['opmc-1']);
    assert.equal(scopedFinance.ok, false);
    const unscopedFinance = ExecutiveMetricService.allowed('revenue', new Set(['finance.read']), undefined);
    assert.deepEqual(unscopedFinance, { ok: true });
    // order revenue is scopable but still needs finance access
    assert.equal(ExecutiveMetricService.allowed('orders_revenue', new Set(['sod.read']), ['opmc-1']).ok, false);
    assert.equal(ExecutiveMetricService.allowed('nope' as never, new Set(), undefined).ok, false);
    assert.ok(METRIC_IDS.includes('net_profit'));
});

test('a card shows value, direction, whether the change is good, and the comparison caption', () => {
    const card = ExecutiveMetricService.card({
        metric: { id: 'completed_orders', label: 'Orders completed', unit: 'count' },
        period: { label: 'Nov 2026', from: '2026-11-01', to: '2026-11-17' },
        compareTo: { label: 'same days of Oct 2026', from: '2026-10-01', to: '2026-10-17' },
        current: 120, previous: 100, change: 20, changePct: 20, good: true,
    });
    assert.equal(card.value, '120');
    assert.equal(card.delta, '+20.0%');
    assert.equal(card.trend, 'up');
    assert.equal(card.good, true);
    assert.match(card.caption ?? '', /same days of Oct 2026: 100/);
    const open = ExecutiveMetricService.card({
        metric: { id: 'open_orders', label: 'Open orders', unit: 'count' },
        period: { label: 'Nov 2026', from: '', to: '' }, compareTo: null, current: 5, previous: null, change: null, changePct: null, good: null,
    });
    assert.equal(open.caption, 'right now');
    assert.equal(open.delta, undefined);
});

after(() => { setTimeout(() => process.exit(process.exitCode ?? 0), 100).unref?.(); });
