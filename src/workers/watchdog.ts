/**
 * Queue watchdog: restarts the app when the BullMQ workers stop taking jobs.
 *
 * Production, 27 Nov 2026: the workers' blocking sockets dropped and never came back. The app stayed "healthy"
 * (the web answered) while no job ran for an hour: 43 SOD sweeps sat overdue, notifications and stats waited.
 * Docker only restarts a process that exits, so this watchdog turns "the workers are stuck" into an exit.
 *
 * A queue is stalled when nothing in it is active and its oldest delayed job is more than STALL_MS past due or
 * its oldest waiting job is older than STALL_MS. A failing SLT portal is NOT a stall: those jobs are still taken
 * and fail. Recovery is a process exit (Docker restart policy unless-stopped brings it back in seconds, and the
 * boot kickstart resumes the sync); it needs the stall to last RESTART_AFTER_MS, waits BOOT_GRACE_MS after a
 * start, and never restarts more than MAX_RESTARTS_PER_HOUR times an hour (counted in Redis, so it survives the
 * restart). The state is exported on /api/metrics (slts_queue_stalled, slts_watchdog_last_restart_timestamp_seconds)
 * and Prometheus sends it to Telegram.
 */
import { redis } from '@/lib/redis';
import { QUEUE_NAMES } from '@/lib/queue';

export const WATCHDOG = {
    CHECK_EVERY_MS: 2 * 60 * 1000,
    STALL_MS: 10 * 60 * 1000,
    RESTART_AFTER_MS: 10 * 60 * 1000,
    BOOT_GRACE_MS: 5 * 60 * 1000,
    MAX_RESTARTS_PER_HOUR: 3,
    RESTART_COUNT_KEY: 'watchdog:restarts:hour',
    LAST_RESTART_KEY: 'watchdog:last-restart',
} as const;

export interface QueueSnapshot {
    queue: string;
    /** When the oldest delayed job is due (ms), or null when none is delayed */
    oldestDelayedDueAt: number | null;
    /** When the oldest waiting job was added (ms), or null when nothing waits */
    oldestWaitingAddedAt: number | null;
    active: number;
}

/** Which queues are stalled now (pure, unit tested). */
export function stalledQueues(snapshots: QueueSnapshot[], now: number, stallMs: number = WATCHDOG.STALL_MS): string[] {
    // Only a queue with nothing active: busy workers (long sync passes fill all slots) promote delayed jobs late,
    // which is not a stall.
    return snapshots
        .filter((s) => s.active === 0 && (
            (s.oldestDelayedDueAt !== null && now - s.oldestDelayedDueAt > stallMs) ||
            (s.oldestWaitingAddedAt !== null && now - s.oldestWaitingAddedAt > stallMs)))
        .map((s) => s.queue);
}

/** Whether to restart now (pure, unit tested). */
export function shouldRestart(args: { stalledSince: number | null; now: number; bootedAt: number; restartsThisHour: number }): boolean {
    const { stalledSince, now, bootedAt, restartsThisHour } = args;
    if (stalledSince === null) return false;
    if (now - bootedAt < WATCHDOG.BOOT_GRACE_MS) return false;
    if (now - stalledSince < WATCHDOG.RESTART_AFTER_MS) return false;
    return restartsThisHour < WATCHDOG.MAX_RESTARTS_PER_HOUR;
}

/** Read one queue's state from Redis (BullMQ keys: bull:<queue>:delayed / :wait / :active). */
async function snapshot(queue: string): Promise<QueueSnapshot> {
    const prefix = `bull:${queue}`;
    const [delayed, oldestWaitingId, active] = await Promise.all([
        redis.zrange(`${prefix}:delayed`, 0, 0, 'WITHSCORES'),
        redis.lindex(`${prefix}:wait`, -1),
        redis.llen(`${prefix}:active`),
    ]);
    // BullMQ stores a delayed job's score as dueTimestamp * 0x1000 + counter
    const oldestDelayedDueAt = delayed.length === 2 ? Math.floor(Number(delayed[1]) / 0x1000) : null;
    const addedAt = oldestWaitingId ? await redis.hget(`${prefix}:${oldestWaitingId}`, 'timestamp') : null;
    return { queue, oldestDelayedDueAt, oldestWaitingAddedAt: addedAt ? Number(addedAt) : null, active };
}

/** Shared with /api/metrics (same process; globalThis because Next can load the route in another module graph). */
interface WatchdogState { stalled: string[]; checkedAt: number; stalledSince: number | null }
const state = ((globalThis as unknown as { __sltsWatchdog?: WatchdogState }).__sltsWatchdog ??= { stalled: [], checkedAt: 0, stalledSince: null });

export function watchdogState(): WatchdogState {
    return state;
}

let timer: ReturnType<typeof setInterval> | null = null;

export function startQueueWatchdog(): void {
    if (timer) return;
    const bootedAt = Date.now();
    const queues = Object.values(QUEUE_NAMES);
    timer = setInterval(async () => {
        try {
            if (redis.status !== 'ready') return; // Redis down is RedisDown's alert, not a worker stall
            const now = Date.now();
            const snaps = await Promise.all(queues.map(snapshot));
            const stalled = stalledQueues(snaps, now);
            state.stalled = stalled;
            state.checkedAt = now;
            if (stalled.length === 0) { state.stalledSince = null; return; }
            state.stalledSince ??= now;
            console.warn(`[WATCHDOG] Queues not being processed: ${stalled.join(', ')} (since ${new Date(state.stalledSince).toISOString()})`);

            const restartsThisHour = Number((await redis.get(WATCHDOG.RESTART_COUNT_KEY)) ?? 0);
            if (!shouldRestart({ stalledSince: state.stalledSince, now, bootedAt, restartsThisHour })) return;

            const n = await redis.incr(WATCHDOG.RESTART_COUNT_KEY);
            if (n === 1) await redis.expire(WATCHDOG.RESTART_COUNT_KEY, 3600);
            await redis.set(WATCHDOG.LAST_RESTART_KEY, JSON.stringify({ at: now, queues: stalled }));
            console.error(`[WATCHDOG] Workers stuck for ${Math.round((now - state.stalledSince) / 60000)} min on ${stalled.join(', ')}: exiting so Docker restarts the app (restart ${n} this hour).`);
            setTimeout(() => process.exit(1), 2000);
        } catch (err) {
            console.warn('[WATCHDOG] Check failed:', err instanceof Error ? err.message : err);
        }
    }, WATCHDOG.CHECK_EVERY_MS);
    timer.unref?.();
    console.log('[WATCHDOG] Queue watchdog started (checks every 2 min; restarts after 10 min of stalled queues, max 3 an hour).');
}
