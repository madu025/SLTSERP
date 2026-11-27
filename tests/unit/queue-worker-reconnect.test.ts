import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * Production, 27 Nov 2026: the worker connections had `retryStrategy: () => null`. BullMQ copies the worker
 * connection for its blocking job fetch; that copy dropped once and never came back, so every worker stopped
 * taking jobs (43 SOD sweeps overdue, notifications and stats stalled) while the app looked healthy.
 */
const src = readFileSync(new URL('../../src/lib/redis-queue.ts', import.meta.url), 'utf8');

test('worker connections reconnect after a drop, with a capped backoff', async () => {
    const { workerRetryDelay } = await import('../../src/lib/redis-queue');
    assert.deepEqual([1, 2, 3, 4, 5, 6, 50].map(workerRetryDelay), [500, 1000, 2000, 4000, 8000, 8000, 8000]);
    for (const n of [1, 10, 1000]) assert.equal(typeof workerRetryDelay(n), 'number', 'never null: a worker never gives up');
});

test('every worker uses the reconnecting connection; the producer stays fail-fast', () => {
    assert.match(src, /export function createQueueConnection\(label: string\): ConnectionOptions \{\s*return asBullMQ\(connect\(label, \{ reconnect: true \}\)\);/);
    assert.match(src, /\.\.\.\(opts\.reconnect \? \{ retryStrategy: workerRetryDelay \} : \{\}\)/);
    assert.match(src, /const producer = connect\('sltserp-producer'\);/, 'the producer keeps the fail-fast options');
    for (const w of ['import', 'notification', 'sod-sync', 'stats-update', 'system']) {
        assert.match(readFileSync(new URL(`../../src/workers/${w}.worker.ts`, import.meta.url), 'utf8'), /connection: createQueueConnection\('worker:/);
    }
});

test('the daily automation never deletes audit logs (immutable; retention is AuditRetentionService), so the job no longer fails every day', () => {
    const auto = readFileSync(new URL('../../src/services/automation/index.ts', import.meta.url), 'utf8');
    assert.doesNotMatch(auto, /AuditRepository\.deleteMany/);
    assert.match(auto, /NotificationRepository\.deleteMany\(\{\s*createdAt: \{ lt: oneMonthAgo \},\s*isRead: true\s*\}\)/, 'old read notifications are still cleaned');
});

test('the request-path Redis client keeps reconnecting in production but never makes a request wait', () => {
    const r = readFileSync(new URL('../../src/lib/redis.ts', import.meta.url), 'utf8');
    assert.match(r, /enableOfflineQueue: false/);
    assert.match(r, /if \(!isProduction && times > 2\) return null;\s*return Math\.min\(200 \* times, 5000\);/);
});

test('the app never calls KEYS (blocking, and refused for the app ACL user); it uses scanKeys', () => {
    for (const f of ['src/lib/cache.service.ts', 'src/services/gis/GISImportService.ts', 'src/services/system/traffic.service.ts']) {
        const s = readFileSync(new URL(`../../${f}`, import.meta.url), 'utf8');
        assert.doesNotMatch(s, /redis\.keys\(/, f);
        assert.match(s, /scanKeys\(/, f);
    }
    assert.match(readFileSync(new URL('../../src/lib/redis.ts', import.meta.url), 'utf8'), /await redis\.scan\(cursor, 'MATCH', pattern, 'COUNT', count\)/);
});

test('the app cache wakes a lazy Redis client instead of staying off, and counts its own hits and misses for /api/metrics', () => {
    const c = readFileSync(new URL('../../src/lib/cache.service.ts', import.meta.url), 'utf8');
    assert.match(c, /if \(redis\.status === 'wait' \|\| redis\.status === 'end' \|\| redis\.status === 'close'\) \{\s*redis\.connect\(\)\.catch\(\(\) => undefined\);/);
    assert.match(c, /cacheHits\+\+;/);
    assert.match(c, /cacheMisses\+\+; return null;/);
    const p = readFileSync(new URL('../../src/services/admin/prometheus.service.ts', import.meta.url), 'utf8');
    for (const m of ['slts_cache_hits_total', 'slts_cache_misses_total', 'slts_cache_errors_total']) assert.ok(p.includes(`\`${m} \${`), m);
});
