import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { detectSeriesAnomalies, detectRtomDrops, detectBacklog, projectMonthEnd, backtestError, ExecutiveInsightService } from '../../src/services/ai/executive-insights.service';

test('a quiet series raises no anomaly, a sudden drop or spike does', () => {
    const steady = Array.from({ length: 42 }, (_, i) => 100 + (i % 3));
    assert.deepEqual(detectSeriesAnomalies(steady), []);
    const dropped = [...steady];
    dropped[40] = 20;
    const hits = detectSeriesAnomalies(dropped);
    assert.equal(hits.length, 1);
    assert.equal(hits[0].index, 40);
    assert.ok(hits[0].value < hits[0].expected);
    const spiked = [...steady];
    spiked[35] = 400;
    assert.equal(detectSeriesAnomalies(spiked)[0].value, 400);
});

test('tiny absolute swings are not anomalies even when the baseline is flat', () => {
    const flat = Array.from({ length: 42 }, () => 3);
    flat[41] = 5; // 2 more orders is noise, not news
    assert.deepEqual(detectSeriesAnomalies(flat), []);
    assert.deepEqual(detectSeriesAnomalies([1, 2, 3]), []); // too little history
});

test('RTOM drops need a real prior volume and a large fall', () => {
    const rows = [
        { rtom: 'R-A', recent: 10, priorWeeklyAvg: 50 },  // down 80%
        { rtom: 'R-B', recent: 45, priorWeeklyAvg: 50 },  // down 10%, fine
        { rtom: 'R-C', recent: 0, priorWeeklyAvg: 5 },    // tiny volume, ignored
    ];
    const out = detectRtomDrops(rows);
    assert.deepEqual(out.map((r) => r.rtom), ['R-A']);
    assert.equal(Math.round(out[0].dropPct), 80);
});

test('backlog flags RTOMs far above the typical old-order count', () => {
    const rows = [
        { rtom: 'R-A', open: 100, over14: 80 },
        { rtom: 'R-B', open: 40, over14: 5 },
        { rtom: 'R-C', open: 30, over14: 4 },
        { rtom: 'R-D', open: 50, over14: 6 },
    ];
    assert.deepEqual(detectBacklog(rows).map((r) => r.rtom), ['R-A']);
    assert.deepEqual(detectBacklog([]), []);
});

test('month-end projection scales the pace, and the back-test measures its error', () => {
    assert.equal(projectMonthEnd(150, 15, 30), 300);
    assert.equal(projectMonthEnd(10, 0, 30), 10);
    assert.equal(backtestError([]), null);
    assert.ok(Math.abs((backtestError([{ projected: 90, actual: 100 }, { projected: 120, actual: 100 }]) ?? 0) - 15) < 1e-9);
    assert.equal(backtestError([{ projected: 5, actual: 0 }]), null);
});

test('projections, profiles and anomaly checks refuse users without the capability', async () => {
    const none = new Set<string>();
    assert.ok('error' in (await ExecutiveInsightService.project('completed_orders', none, undefined)));
    assert.ok('error' in (await ExecutiveInsightService.project('open_orders', new Set(['sod.read']), undefined)));
    assert.ok('error' in (await ExecutiveInsightService.project('revenue', new Set(['finance.read']), ['opmc-1'])));
    assert.ok('error' in (await ExecutiveInsightService.profile('rtom', 'R-JA', none, undefined)));
    assert.ok('error' in (await ExecutiveInsightService.profile('rtom', ' ', new Set(['sod.read']), undefined)));
    assert.ok('error' in (await ExecutiveInsightService.anomalies(none, undefined)));
});

after(() => { setTimeout(() => process.exit(process.exitCode ?? 0), 100).unref?.(); });
