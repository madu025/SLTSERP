export const dynamic = 'force-dynamic';

import { apiHandler } from '@/lib/api-handler';
import { SystemService } from '@/services/core/system.service';
import { SyncAuditService } from '@/services/service-order/sync/sync-audit.service';
import { SYNC_FEEDS } from '@/services/service-order/sync/types';
import { redis } from '@/lib/redis';
import { logger } from '@/lib/logger';
import { systemQueue } from '@/lib/queue';

/**
 * Health probe with a time ceiling.
 *
 * Why this file exists in its current shape (measured 2026-09-05): the endpoint answered
 * 504 FUNCTION_INVOCATION_TIMEOUT on Vercel, twice in a row at ~15.5s, i.e. it consumed the
 * whole 15s function budget from vercel.json and never produced a body. The cause is the queue
 * probe: src/lib/redis-queue.ts sets `maxRetriesPerRequest: null` because BullMQ blocking
 * commands must be allowed to wait for their socket, so `getActiveCount()` against a Redis that
 * this tier cannot reach waits forever. `queueConnectionAlive()` does not catch it either - it
 * only reports false once the socket is `end`/`close`, and a client stuck in `connecting` is
 * neither. The Redis client in src/lib/redis.ts is already safe (offline queue off, 2s connect
 * timeout); the queue path was the unbounded one.
 *
 * A health endpoint that can hang is worse than one that reports a failure, because it is
 * indistinguishable from an outage of the app itself. So every probe here is raced against a
 * deadline, the probes run concurrently (worst case is one budget, not three), and a probe that
 * misses its budget is reported as `timeout` instead of blocking the response.
 */
const PROBE_BUDGET_MS = 3000;

/**
 * Per-feed sync staleness ceilings, defined LOCALLY on purpose. The authoritative schedule lives in
 * sod.sync.service.ts (TICK_DAILY_JOBS) and is deliberately NOT imported: this probe stays read-only
 * and decoupled from the scheduler, so the ceilings are restated here per feed family.
 *   - tick-driven feeds (default): the external Master Tick fires every 10 minutes, so a healthy feed
 *     has a clean success within ~2 windows; 25 min = 2 missed ticks plus margin.
 *   - DAILY_REPORT: wall-clock daily (00:15 SL) -> a 26h ceiling; flagging it at 25 min is pure noise.
 *   - NOTIFICATION_CLEANUP: WEEKLY (Sun 02:00 SL, onlyOn:0) -> an 8-day ceiling. Applying the 26h
 *     daily ceiling here flagged it permanently stale 6 days a week (false positive).
 */
const SYNC_STALE_AFTER_MIN = 25;
const SYNC_DAILY_STALE_AFTER_MIN = 26 * 60;
const SYNC_WEEKLY_STALE_AFTER_MIN = 8 * 24 * 60;
/** Explicit per-feed ceilings; every feed not listed is tick-driven and gets the 25-min default. */
const SYNC_FEED_STALE_MIN: Readonly<Record<string, number>> = {
    DAILY_REPORT: SYNC_DAILY_STALE_AFTER_MIN,
    NOTIFICATION_CLEANUP: SYNC_WEEKLY_STALE_AFTER_MIN,
};
const staleThresholdFor = (feed: string): number => SYNC_FEED_STALE_MIN[feed] ?? SYNC_STALE_AFTER_MIN;

/**
 * Feeds whose recent clean success proves the sync machinery (serverless inline tick today; a
 * self-hosted BullMQ worker remains an option) is alive. 'TICK' is deliberately excluded: no
 * SyncRun row is ever written with feed:'TICK' (the
 * tick records failures via recordError with runId null -> SystemErrorLog only), so it can never
 * prove liveness and would pin the whole tier permanently stale. Liveness is derived from these
 * feeds rather than a Redis worker list: the queue-provider interface exposes no getWorkers(), and
 * SyncRun is written by whichever tier actually drains the queue, so "a sweep succeeded recently" is
 * the honest cross-tier proof that sync is being executed.
 */
const SYNC_LIVENESS_FEEDS = ['RTOM_SWEEP', 'PENDING_SWEEP'];

type ProbeState = 'healthy' | 'unhealthy' | 'timeout';

interface ProbeResult<T> {
    state: ProbeState;
    ms: number;
    value: T;
}

interface PoolMetrics {
    active: number;
    idle: number;
    wait: number;
}

interface SyncFeedHealth {
    feed: string;
    /** ISO instant of the newest clean successful run, or null when the feed never succeeded in the retained window. */
    lastSuccessAt: string | null;
    /** Minutes since lastSuccessAt, or null when there is no successful run (such a feed is always stale). */
    ageMinutes: number | null;
    stale: boolean;
}

interface SyncHealth {
    /** A tick-driven sync pass succeeded within the stale window - the queue is being drained. */
    workerAlive: boolean;
    /** Which feed proved liveness, or null when none is fresh. */
    workerSignalFeed: string | null;
    /** Feeds whose newest successful run is older than their threshold. */
    staleFeeds: string[];
    feeds: SyncFeedHealth[];
}

const EMPTY_SYNC_HEALTH: SyncHealth = {
    workerAlive: false,
    workerSignalFeed: null,
    staleFeeds: [],
    feeds: [],
};

/**
 * Runs one probe without letting it outlive `budgetMs`. The returned promise never rejects:
 * a rejected probe would surface as a 500 from the wrapper instead of a readable report, and an
 * unhandled rejection outlives the response.
 */
async function probe<T>(run: () => Promise<T>, fallback: T, label: string, budgetMs = PROBE_BUDGET_MS): Promise<ProbeResult<T>> {
    const startedAt = Date.now();
    let timer: ReturnType<typeof setTimeout> | undefined;

    const settled = run().then(
        (value): { outcome: 'done'; value: T } => ({ outcome: 'done', value }),
        (error: unknown): { outcome: 'failed' } => {
            logger.error(`Health Check: ${label} failed`, error);
            return { outcome: 'failed' };
        },
    );
    const budget = new Promise<'timeout'>(resolve => {
        timer = setTimeout(() => resolve('timeout'), budgetMs);
    });

    try {
        const raced = await Promise.race([settled, budget]);
        const ms = Date.now() - startedAt;
        if (raced === 'timeout') {
            // The probe promise is ABANDONED, not cancelled: with ioredis `maxRetriesPerRequest: null`
            // a pending command can outlive this response and settle later with no listener attached.
            // Threading a real AbortSignal through every client is out of scope for a health probe, so
            // the cheap-but-honest version is to log the abandonment explicitly for observability.
            logger.warn(`Health Check: ${label} exceeded its ${budgetMs}ms budget - probe abandoned (not cancelled)`, { ms, budgetMs, abandoned: true });
            return { state: 'timeout', ms, value: fallback };
        }
        return {
            state: raced.outcome === 'done' ? 'healthy' : 'unhealthy',
            ms,
            value: raced.outcome === 'done' ? raced.value : fallback,
        };
    } finally {
        if (timer) clearTimeout(timer);
    }
}

interface HealthReport {
    status: 'ok' | 'degraded' | 'error';
    timestamp: string;
    services: {
        database: ProbeState;
        redis: ProbeState;
        queue: ProbeState;
    };
    /** Per-probe wall clock, so a slow dependency is visible before it becomes an outage. */
    latencyMs: {
        database: number;
        redis: number;
        queue: number;
        sync: number;
    };
    monitoring: {
        pool: PoolMetrics | null;
    };
    /** Sync orchestration liveness, derived read-only from the SyncRun census table. */
    sync: SyncHealth;
}

export const GET = apiHandler(async () => {
    // Postgres is this tier's only hard dependency. Redis belongs to the optional self-hosted
    // worker tier, so the Vercel web tier is expected to be unable to reach it (inline mode runs
    // no worker); the queue's own availability is alarmed where it actually matters, by the enqueue
    // routes' 502/503 to the Master Tick. Failing the endpoint for a by-design unreachable Redis
    // would make health-check loops of any future self-hosted container report 503 on healthy runs.
    const [database, cache, queue, sync] = await Promise.all([
        probe(async () => ({ pool: await SystemService.checkDatabaseHealth() as PoolMetrics | null }), { pool: null }, 'database'),
        probe(async () => (await redis.ping()) === 'PONG', false, 'redis'),
        probe(async () => (await systemQueue.getActiveCount()) >= 0, false, 'queue'),
        probe(async () => {
            const runs = await SyncAuditService.latestSuccessfulRuns();
            const lastSuccessByFeed = new Map(runs.map((r) => [r.feed, r.lastSuccessAt]));
            const now = Date.now();
            // Seed the report from the canonical SYNC_FEEDS vocabulary, not from the returned rows.
            // An expected feed with NO clean successful run in the retained window is emitted
            // {stale:true, lastSuccessAt:null} instead of silently vanishing - a dead daily/weekly
            // feed must never read as healthy just because it produced no row to map.
            const feeds: SyncFeedHealth[] = SYNC_FEEDS
                .map((feed): SyncFeedHealth => {
                    const lastSuccessAt = lastSuccessByFeed.get(feed);
                    if (!lastSuccessAt) return { feed, lastSuccessAt: null, ageMinutes: null, stale: true };
                    const ageMinutes = Math.round((now - lastSuccessAt.getTime()) / 60000);
                    return { feed, lastSuccessAt: lastSuccessAt.toISOString(), ageMinutes, stale: ageMinutes > staleThresholdFor(feed) };
                })
                // Fresh feeds first; never-succeeded feeds (ageMinutes null) sort to the end.
                .sort((a, b) => (a.ageMinutes ?? Number.MAX_SAFE_INTEGER) - (b.ageMinutes ?? Number.MAX_SAFE_INTEGER));
            const liveness = feeds.find((f) => SYNC_LIVENESS_FEEDS.includes(f.feed) && !f.stale);
            const workerAlive = !!liveness;
            return {
                workerAlive,
                workerSignalFeed: liveness ? liveness.feed : null,
                staleFeeds: feeds.filter((f) => f.stale).map((f) => f.feed),
                feeds,
            } satisfies SyncHealth;
        }, EMPTY_SYNC_HEALTH, 'sync'),
    ]);

    // The sync tier is DOWN only on a TOTAL outage: the census was read successfully (probe healthy)
    // and NOT ONE liveness feed is fresh. Gating on `sync.state === 'healthy'` means a slow/timed-out
    // scan reports "unknown" rather than falsely declaring an outage. Transient/partial staleness of
    // an individual low-volume feed does NOT set this - it is visible in sync.staleFeeds only.
    const syncDown = sync.state === 'healthy' && !sync.value.workerAlive;

    const status: HealthReport['status'] = database.state !== 'healthy'
        ? 'error'
        : (cache.state !== 'healthy' || queue.state !== 'healthy' || syncDown)
            ? 'degraded'
            : 'ok';

    const report: HealthReport = {
        status,
        timestamp: new Date().toISOString(),
        services: {
            database: database.state,
            redis: cache.state,
            queue: queue.state,
        },
        latencyMs: {
            database: database.ms,
            redis: cache.ms,
            queue: queue.ms,
            sync: sync.ms,
        },
        monitoring: {
            pool: database.value.pool,
        },
        sync: sync.value,
    };

    // HTTP status contract (alarm-safe for an external uptime monitor keyed on non-2xx):
    //   503 -> the database is unhealthy OR the sync tier is FULLY stale (syncDown). These are the
    //          conditions that actually stop work, so an uptime monitor must be able to see them.
    //   200 -> everything else, INCLUDING transient/partial feed staleness and the by-design
    //          unreachable Redis/queue on the serverless web tier. Those are reported in the body
    //          (status:'degraded', sync.staleFeeds) but must not page anyone via a non-2xx code.
    const httpStatus = (database.state !== 'healthy' || syncDown) ? 503 : 200;
    return Response.json(report, { status: httpStatus });
}, { rawResponse: true });
