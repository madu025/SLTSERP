/**
 * Sync audit recorder - one SyncRun row per feed pass.
 *
 * Two jobs:
 *  1. Observability. Every pass reports fetched/created/updated/skipped/blocked plus the verdict
 *     tally, so rollout decisions come from a table instead of grepping container logs.
 *  2. Idempotency. `SyncRun(feed, windowKey)` is unique, and windowKey is derived from the feed
 *     plus the deterministic window start. A double-fired Master Tick inside the same minute
 *     therefore resolves to the same key and is refused instead of running the same window twice.
 *
 * Errors are written to SystemErrorLog as well as returned in `errors[]`: sync failures used to be
 * invisible to the error log (defect O7 - 54 portal "Photo evidence" failures in 1.5h, zero rows).
 */

import { primaryClient } from '@/lib/prisma';
import { SystemMonitoringService } from '@/services/admin/system-monitoring.service';
import { syncStatusPolicyMode } from '@/lib/constants/sod-status-policy';
import type { SyncCounters, SyncFeed, SyncWindow } from './types';

/** A run row still unfilled after this long is a crash artifact, not a live pass. */
const STALE_RUN_MS = 15 * 60 * 1000;

export type RunStartState =
    /** Fresh window - do the work. */
    | 'STARTED'
    /** Same window is being executed right now - the caller must not run it again. */
    | 'IN_FLIGHT'
    /** Same window already completed - a replay (double cron fire). */
    | 'REPLAY';

export interface StartedRun {
    readonly runId: string;
    readonly state: RunStartState;
    readonly windowKey: string;
}

function minuteKey(d: Date | null): string {
    if (!d) return 'full';
    return new Date(d.getTime() - (d.getTime() % 60_000)).toISOString();
}

/** Deterministic window identity. Deliberately excludes anything that varies per attempt. */
export function windowKeyFor(feed: SyncFeed, rtom: string | null | undefined, window: SyncWindow): string {
    return `${rtom || '-' }|${minuteKey(window.start)}|${minuteKey(window.end)}`;
}

/**
 * The pass identity for a scheduled feed: the Master Tick bucket it belongs to.
 *
 * A feed whose *data* window is long (the completed feed walks the whole current month) must not
 * use that range as its dedup key, or every 20-minute run after the first would look like a replay
 * of the same window and be refused. The bucket is what makes a pass unique: one row per feed per
 * tick, and a double-fired tick inside the same bucket collides - which is exactly the duplicate
 * this guard exists to catch.
 *
 * `start` is narrowed to a non-null Date because a bucket always begins somewhere; callers use it
 * as a notification dedup key, where a nullable instant would silently merge unrelated ticks.
 */
export function tickWindow(now: Date = new Date(), bucketMs = 10 * 60 * 1000): SyncWindow & { start: Date } {
    return { start: new Date(Math.floor(now.getTime() / bucketMs) * bucketMs), end: null };
}

export interface RunOutcome {
    counters?: Partial<SyncCounters>;
    decisions?: Record<string, number>;
    errors?: string[];
}

/**
 * Outcome picker for the feeds that already return the standard counter vocabulary
 * (`syncServiceOrders` and its callers). Feeds reporting in their own terms (PAT `total`,
 * HO `totalCached`) pass an explicit mapper instead, so nothing here guesses at field meanings.
 */
export const syncCountersOf = (r: Partial<SyncCounters> & { decisions?: Record<string, number> }): RunOutcome => ({
    counters: {
        fetched: r.fetched ?? 0,
        created: r.created ?? 0,
        updated: r.updated ?? 0,
        skippedNoChange: r.skippedNoChange ?? 0,
        blockedByPolicy: r.blockedByPolicy ?? 0,
    },
    decisions: r.decisions,
});

export class SyncAuditService {
    /**
     * Claim a window. Returns IN_FLIGHT / REPLAY when another execution already owns the key, in
     * which case the caller must skip the pass. A stale unfinished row (crashed process) is
     * reclaimed so the feed cannot deadlock.
     */
    static async startRun(params: {
        feed: SyncFeed;
        rtom?: string | null;
        opmcId?: string | null;
        window?: SyncWindow;
    }): Promise<StartedRun> {
        const { feed, rtom = null, opmcId = null } = params;
        const window = params.window ?? { start: null, end: null };
        const key = windowKeyFor(feed, rtom, window);
        const now = new Date();

        const run = await primaryClient.syncRun.upsert({
            where: { feed_windowKey: { feed, windowKey: key } },
            create: {
                feed,
                windowKey: key,
                rtom,
                opmcId,
                windowStart: window.start,
                windowEnd: window.end,
                startedAt: now,
                mode: syncStatusPolicyMode(),
            },
            update: {},
            select: { id: true, startedAt: true, finishedAt: true },
        });

        const unfinished = !run.finishedAt;
        const ageMs = now.getTime() - new Date(run.startedAt).getTime();

        if (!unfinished) {
            // This exact window already ran to completion: a double-fired tick. The census row is
            // left exactly as it was, so the duplicate attempt is itself visible in the table.
            return { runId: run.id, state: 'REPLAY', windowKey: key };
        }
        if (ageMs <= STALE_RUN_MS) {
            // Another process owns this window. Skip; do not touch its row (its counters live there).
            return { runId: run.id, state: 'IN_FLIGHT', windowKey: key };
        }

        // Crashed pass older than the stale bound: reclaim the row and reset the counters, so it
        // describes this retry instead of a corpse. Without this a feed could deadlock forever.
        await primaryClient.syncRun.update({
            where: { id: run.id },
            data: {
                startedAt: now,
                finishedAt: null,
                windowStart: window.start,
                windowEnd: window.end,
                fetched: 0, created: 0, updated: 0, skippedNoChange: 0, blockedByPolicy: 0,
                decisions: {}, errors: [], mode: syncStatusPolicyMode(),
            },
        });
        return { runId: run.id, state: 'STARTED', windowKey: key };
    }

    /**
     * Run a whole pass under a SyncRun row: claim the window, execute, persist the counters, and on
     * throw log the error to the row plus SystemErrorLog before rethrowing.
     *
     * Returns null when the window was refused, which is the caller's signal to skip its own work.
     * Any *scheduling* hop must stay outside the body: a pass refused because another process owns
     * the window would otherwise drop the hop and kill a self-chaining sweep for the rest of the day.
     */
    static async tracedRun<T>(
        params: { feed: SyncFeed; rtom?: string | null; opmcId?: string | null; window?: SyncWindow },
        body: () => Promise<T>,
        toOutcome: (result: T) => RunOutcome = () => ({}),
    ): Promise<T | null> {
        const { feed } = params;
        const run = await this.startRun(params);
        if (run.state !== 'STARTED') {
            console.log(`[SYNC-RUN] ${feed} pass refused (${run.state}, key ${run.windowKey})`);
            return null;
        }

        try {
            const result = await body();
            const outcome = toOutcome(result) || {};
            await this.finishRun(run.runId, outcome);
            return result;
        } catch (error) {
            const line = await this.recordError({ feed, context: `${feed} pass`, error, runId: run.runId });
            // Close the row even on failure: an unfinished run is indistinguishable from a crash
            // until STALE_RUN_MS passes, and the next legitimate window has a different key anyway.
            await this.finishRun(run.runId, { errors: [line] });
            throw error;
        }
    }

    /** Persist one feed result. Never throws - an audit failure must not fail the feed. */
    static async finishRun(runId: string, result: RunOutcome): Promise<void> {
        try {
            await primaryClient.syncRun.update({
                where: { id: runId },
                data: {
                    finishedAt: new Date(),
                    ...(result.counters || {}),
                    decisions: result.decisions ? JSON.parse(JSON.stringify(result.decisions)) : undefined,
                    errors: result.errors ? JSON.parse(JSON.stringify(result.errors.slice(0, 50))) : undefined,
                },
            });
        } catch (err) {
            console.error(`[SYNC-AUDIT] Failed to close run ${runId}:`, err);
        }
    }

    /**
     * Record a feed failure where it can actually be seen: the run row, the returned error list,
     * and SystemErrorLog. `path` is namespaced by feed so the admin error screen can filter it.
     */
    static async recordError(params: {
        feed: SyncFeed;
        context: string;
        error: unknown;
        runId?: string | null;
        metadata?: Record<string, unknown>;
    }): Promise<string> {
        const { feed, context, error, runId = null } = params;
        const message = error instanceof Error ? error.message : String(error);
        const stack = error instanceof Error ? error.stack : undefined;
        const line = `${context}: ${message}`;

        if (runId) {
            // Json columns have no atomic push in Prisma, so this is read-modify-write. Losing one
            // line to a concurrent writer is acceptable here; failing the feed for an audit row is not.
            try {
                const row = await primaryClient.syncRun.findUnique({ where: { id: runId }, select: { errors: true } });
                const current = Array.isArray(row?.errors) ? (row.errors as unknown[]) : [];
                await primaryClient.syncRun.update({
                    where: { id: runId },
                    data: { errors: JSON.parse(JSON.stringify([...current, line].slice(-50))) },
                });
            } catch (err) {
                console.error(`[SYNC-AUDIT] Failed to append error to run ${runId}:`, err);
            }
        }

        try {
            await SystemMonitoringService.logError({
                statusCode: 502,
                errorCode: `SYNC_${feed}`,
                message: `[${feed}] ${line}`,
                stackTrace: stack,
                path: `sync/${feed.toLowerCase()}`,
                method: 'WORKER',
                metadata: params.metadata,
            });
        } catch (err) {
            console.error(`[SYNC-AUDIT] Failed to log ${feed} error to SystemErrorLog:`, err);
        }

        return line;
    }

    /** Retention: SyncRun is an operational table, not a history archive. */
    static async pruneRuns(retentionDays = 14): Promise<{ deleted: number; oldestKept: string }> {
        const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
        const deleted = await primaryClient.syncRun.deleteMany({ where: { startedAt: { lt: cutoff } } });
        return { deleted: deleted.count, oldestKept: cutoff.toISOString() };
    }
}
