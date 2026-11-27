import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stalledQueues, shouldRestart, WATCHDOG } from '../../src/workers/watchdog';

const MIN = 60 * 1000;
const now = Date.parse('2026-11-27T04:07:00Z');
const q = (queue: string, o: Partial<{ delayedDue: number | null; waitingAdded: number | null; active: number }> = {}) =>
    ({ queue, oldestDelayedDueAt: o.delayedDue ?? null, oldestWaitingAddedAt: o.waitingAdded ?? null, active: o.active ?? 0 });

test('the 27 Nov stall is caught: sweeps due at 03:10 still delayed at 04:07 with nothing active', () => {
    assert.deepEqual(stalledQueues([q('sod-sync-queue', { delayedDue: Date.parse('2026-11-27T03:10:00Z') })], now), ['sod-sync-queue']);
    assert.deepEqual(stalledQueues([q('notifications-queue', { waitingAdded: now - 30 * MIN })], now), ['notifications-queue']);
});

test('not a stall: future or briefly late jobs, busy workers, empty queues', () => {
    assert.deepEqual(stalledQueues([
        q('a', { delayedDue: now + 5 * MIN }),                 // daily job scheduled for later
        q('b', { delayedDue: now - 3 * MIN }),                 // a little late
        q('c', { delayedDue: now - 30 * MIN, active: 6 }),     // all slots busy with long passes
        q('d', { waitingAdded: now - 30 * MIN, active: 2 }),   // working through a backlog
        q('e'),
    ], now), []);
});

test('restart only after 10 stalled minutes, never in the first 5 minutes after boot, at most 3 an hour', () => {
    const base = { now, bootedAt: now - 60 * MIN, restartsThisHour: 0 };
    assert.equal(shouldRestart({ ...base, stalledSince: null }), false);
    assert.equal(shouldRestart({ ...base, stalledSince: now - 4 * MIN }), false);
    assert.equal(shouldRestart({ ...base, stalledSince: now - 11 * MIN }), true);
    assert.equal(shouldRestart({ ...base, stalledSince: now - 11 * MIN, bootedAt: now - 2 * MIN }), false);
    assert.equal(shouldRestart({ ...base, stalledSince: now - 11 * MIN, restartsThisHour: WATCHDOG.MAX_RESTARTS_PER_HOUR }), false);
});

test('the watchdog starts with the workers, exits for Docker to restart, and its state is exported for the Telegram alerts', () => {
    assert.match(readFileSync(new URL('../../src/workers/init.ts', import.meta.url), 'utf8'), /startQueueWatchdog\(\);/);
    const wd = readFileSync(new URL('../../src/workers/watchdog.ts', import.meta.url), 'utf8');
    assert.match(wd, /setTimeout\(\(\) => process\.exit\(1\), 2000\)/);
    assert.match(wd, /if \(redis\.status !== 'ready'\) return;/, 'a Redis outage is not a worker stall');
    const p = readFileSync(new URL('../../src/services/admin/prometheus.service.ts', import.meta.url), 'utf8');
    for (const m of ['slts_queue_stalled{queue=', 'slts_watchdog_last_check_timestamp_seconds ', 'slts_watchdog_last_restart_timestamp_seconds ']) assert.ok(p.includes(m), m);
});
