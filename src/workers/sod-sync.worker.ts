 
process.env.IS_WORKER = 'true';
import { Worker, Job } from 'bullmq';
import { createQueueConnection } from '../lib/redis-queue';
import { QUEUE_NAMES, statsUpdateQueue, addJob } from '../lib/queue';
import { ServiceOrderService } from '../services/service-order/sod.service';
import { AppError } from '../lib/error';
import { SyncAuditService, syncCountersOf, tickWindow } from '../services/service-order/sync/sync-audit.service';
import type { SyncJobData, SyncJobType } from '../services/service-order/sync/types';

/**
 * Job registry, keyed by every member of SyncJobType.
 *
 * The previous shape was an `if/else` chain ending in a bare `else`, so a job queued with a typo'd
 * or not-yet-handled `type` silently ran the pending sync (defect O9). `Record<SyncJobType, ...>`
 * makes an unhandled type a compile error, and the runtime guard turns an old row that survived a
 * redeploy into a loud failure instead of unexpected work.
 *
 * Every pass in the registry is counted in the SyncRun table (one row per feed per window).
 * The guard sits here rather than inside the sync services because `syncServiceOrders` is also the
 * manual "sync this RTOM now" path, which must never be refused for a bucket a scheduled pass
 * already owns - window identity belongs to the scheduler, not to the function. A refused pass
 * returns null, so any scheduling hop stays outside the traced body: a duplicate tick must not be
 * able to end a self-chaining sweep.
 */
const JOB_HANDLERS: Record<SyncJobType, (job: Job<SyncJobData>) => Promise<unknown>> = {
    async PENDING(job) {
        const { opmcId, rtom } = job.data;
        console.log(`[SOD-SYNC-WORKER] Starting Pending SOD sync for RTOM: ${rtom} (Job ID: ${job.id})`);
        const result = await SyncAuditService.tracedRun(
            { feed: 'PENDING_SWEEP', opmcId, rtom, window: tickWindow() },
            () => ServiceOrderService.syncServiceOrders(opmcId, rtom),
            syncCountersOf,
        );
        if (!result) return { skipped: 'window-owned' };
        await ServiceOrderService.updateGlobalSyncStats({ created: result.created, updated: result.updated });
        await addJob(statsUpdateQueue, `stats-${opmcId}`, { opmcId, type: 'SINGLE_OPMC' });
        console.log(`[SOD-SYNC-WORKER] Completed SOD sync for RTOM: ${rtom}. Created: ${result.created}, Updated: ${result.updated}`);
        return result;
    },

    async RTOM_SWEEP(job) {
        const { opmcId, rtom, windowMs, slotMs } = job.data;
        console.log(`[SOD-SYNC-WORKER] RTOM sweep start for ${rtom} (Job ID: ${job.id})`);
        // `windowMs` is the sweep window the job was seeded for; when absent (legacy queue row) the
        // tick default is exactly the seeded window, so the key still matches the job id.
        const result = await SyncAuditService.tracedRun(
            { feed: 'RTOM_SWEEP', opmcId, rtom, window: tickWindow(new Date(), windowMs) },
            () => ServiceOrderService.syncServiceOrders(opmcId, rtom),
            syncCountersOf,
        );
        if (result) {
            await ServiceOrderService.updateGlobalSyncStats({ created: result.created, updated: result.updated });
            await addJob(statsUpdateQueue, `stats-${opmcId}`, { opmcId, type: 'SINGLE_OPMC' });
        }
        // Continuation hop: outside the traced body on purpose. This RTOM's next window is queued
        // whether or not this one was ours to run, so a refused duplicate can never end the chain.
        try {
            await ServiceOrderService.rescheduleRtomSweep(opmcId, rtom, windowMs, slotMs);
        } catch (rescheduleErr) {
            console.error(`[SOD-SYNC-WORKER] RTOM sweep re-seed failed for ${rtom}:`, rescheduleErr);
        }
        if (!result) return { skipped: 'window-owned' };
        console.log(`[SOD-SYNC-WORKER] RTOM sweep done for ${rtom}. Created: ${result.created}, Updated: ${result.updated}`);
        return result;
    },

    async PAT_REJECTION(job) {
        const { opmcId, rtom } = job.data;
        console.log(`[SOD-SYNC-WORKER] Starting PAT/Rejection sync for RTOM: ${rtom} (Job ID: ${job.id})`);
        const result = await SyncAuditService.tracedRun(
            { feed: 'PAT', opmcId, rtom, window: tickWindow() },
            () => ServiceOrderService.syncPatResults(opmcId, rtom),
            (r) => ({ counters: { fetched: r.total, updated: r.updated ?? 0 } }),
        );
        if (!result) return { skipped: 'window-owned' };
        await ServiceOrderService.updateGlobalSyncStats({ updated: result.updated });
        await addJob(statsUpdateQueue, `stats-${opmcId}`, { opmcId, type: 'SINGLE_OPMC' });
        console.log(`[SOD-SYNC-WORKER] Completed PAT sync for RTOM: ${rtom}. Updated: ${result.updated}`);
        return result;
    },

    async PERIODIC_GLOBAL_SYNC() {
        // Tracing lives in SODSyncService.runPeriodicTask so the queued and the inline execution
        // models cannot disagree about what a pass is. One bucket, two feed rows.
        console.log('[SOD-SYNC-WORKER] Starting Periodic Global PAT Sync');
        const result = await ServiceOrderService.runPeriodicTask('PERIODIC_GLOBAL_SYNC');
        console.log('[SOD-SYNC-WORKER] Completed Periodic Global PAT Sync.');
        return result;
    },

    async PERIODIC_PENDING_SYNC(job) {
        // Scheduler tick: the only thing the external 10-minute cron drives. It seeds this
        // window's per-RTOM sweep, the bucket-aligned 20/30-minute cadences, the wall-clock
        // dailies and re-asserts the terminal-status self-heal. Nothing runs inline.
        console.log(`[SOD-SYNC-WORKER] Scheduler tick (Job ID: ${job.id})`);
        return await ServiceOrderService.runPendingSyncTick();
    },

    async PERIODIC_COMPLETED_SYNC() {
        console.log('[SOD-SYNC-WORKER] Starting Periodic Completed SOD Sync');
        // CompletedSODSyncService traces its own run (its data window is wider than its cadence).
        const result = await ServiceOrderService.runPeriodicTask('PERIODIC_COMPLETED_SYNC');
        console.log('[SOD-SYNC-WORKER] Completed Periodic Completed SOD Sync.');
        return result;
    },

    async PERIODIC_RETURN_SYNC() {
        // Return-reason enrichment: rotates a small RTOM slice per run (its own budgeting),
        // so it lives on its own 30-minute repeatable rather than riding the pending tick.
        // The rotation index is derived from the 30-minute clock, so a second pass inside the same
        // bucket would re-walk the identical slice - exactly what the window guard refuses.
        console.log('[SOD-SYNC-WORKER] Starting return-reason enrichment');
        const result = await ServiceOrderService.runPeriodicTask('PERIODIC_RETURN_SYNC');
        if (!result) return { skipped: 'window-owned' };
        console.log(`[SOD-SYNC-WORKER] Return-reason enrichment: ${JSON.stringify(result)}`);
        return result;
    },
};

export const sodSyncWorker = new Worker(
    QUEUE_NAMES.SOD_SYNC,
    async (job: Job<SyncJobData>) => {
        const type = (job.data?.type ?? 'PENDING') as SyncJobType;
        const handler = JOB_HANDLERS[type];
        if (!handler) {
            // Unknown type string on a job that was queued by an older build.
            throw AppError.badRequest(`Unknown sod-sync job type: ${String(type)}`);
        }

        const { rtom } = job.data;
        try {
            return await handler(job);
        } catch (err) {
            await ServiceOrderService.updateGlobalSyncStats({ failed: 1 });
            console.error(`[SOD-SYNC-WORKER] FATAL ERROR for ${type} / RTOM ${rtom} (Job: ${job.id}):`, err);
            throw err;
        }
    },
    {
        connection: createQueueConnection('worker:sod-sync'),
        // One portal request per RTOM is a hard limit of the iShamp feed (it rejects every batch
        // form: con=SLTS, z=SLTS, comma/space lists all answer {"data":[]}), so throughput comes
        // from firing several RTOMs at once. A sweep waits 2-16s (avg ~7s) entirely on portal I/O,
        // which matches the seeded 1.5s stagger: ~5 jobs in flight, all 43 RTOMs inside ~70s.
        concurrency: 6
    }
);

console.log('SOD Sync Worker initialized (Concurrency: 6)');
