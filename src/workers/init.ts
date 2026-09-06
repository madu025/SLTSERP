/**
 * Background Worker Initialization
 * 
 * This file initializes all background processes when the server starts.
 * It is called by Next.js instrumentation.ts.
 */
export async function initializeBackgroundWorkers() {
    console.log('==================================================');
    console.log('[WORKERS] 🔄 BACKGROUND WORKER INIT STARTING... ');
    console.log('==================================================');
    console.log(`[WORKERS] Runtime: ${process.env.NEXT_RUNTIME}`);
    console.log(`[WORKERS] Redis URL: ${process.env.REDIS_URL || 'NOT SET'}`);

    // Pre-check if Redis is reachable before attempting BullMQ Worker instantiation.
    // The shared client runs with enableOfflineQueue: false, so ioredis rejects any command
    // issued before the socket is 'ready' ("Stream isn't writeable and enableOfflineQueue
    // options is false"). Worker init happens during boot, i.e. while the connect is still in
    // flight, so a bare ping() reported a healthy Redis as unreachable and the entire worker
    // pool was skipped. Wait for 'ready' first, then confirm with a ping.
    try {
        const { redis } = await import('../lib/redis');
        await new Promise<void>((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('Redis connect timeout')), 5000);
            const probe = () => {
                redis.ping().then(() => { clearTimeout(timer); resolve(); }, (err: unknown) => { clearTimeout(timer); reject(err); });
            };
            if (redis.status === 'ready') {
                probe();
            } else {
                // retryStrategy gives up after a couple of attempts, which leaves the singleton
                // permanently 'end'; nudge it so a Redis that came up later is still usable.
                if (redis.status === 'end' || redis.status === 'close') {
                    void redis.connect().catch(() => undefined);
                }
                redis.once('ready', probe);
            }
        });
    } catch {
        console.warn('[WORKERS] ⚠️ Redis is not reachable, background workers skipped. Check REDIS_URL.');
        return;
    }

    const { sodSyncQueue, systemQueue } = await import('../lib/queue');
    const { enqueueCronJob } = await import('../lib/cron-enqueue');

    // 🚀 INITIALIZE BULLMQ WORKERS
    try {
        await import('./import.worker');
        await import('./sod-sync.worker');
        await import('./stats-update.worker');
        await import('./system.worker');
        await import('./notification.worker');
        console.log('[WORKERS] ✅ All BullMQ Workers (Import, Sync, Stats, System, Notifications) initialized');
    } catch (err) {
        console.error('[WORKERS] ❌ Worker initialization failed:', err);
    }

    // 🕊️ ONE CLOCK ONLY - no internal scheduler is registered here any more.
    //
    // Scheduling comes from the external cron (cron-job.org, every 10 minutes, 24h) hitting
    // /api/cron/sync-all. That tick seeds everything (SODSyncService.runPendingSyncTick): the
    // per-RTOM sweep window, the bucket-aligned 20/30-minute cadences, the wall-clock dailies and
    // the terminal-status self-heal.
    //
    // BullMQ repeatables survive in Redis even after their registration code is deleted, so they
    // are cleared once at boot - leaving them would silently double every portal call.
    try {
        const cleared = (await sodSyncQueue.removeRepeatableJobs()) + (await systemQueue.removeRepeatableJobs());
        console.log(cleared > 0
            ? `[WORKERS] 🧹 Cleared ${cleared} legacy BullMQ repeatable job(s); the external 10-minute cron tick is now the only scheduler.`
            : '[WORKERS] No internal repeatables registered - scheduling is owned by the external 10-minute cron tick.');
    } catch (err) {
        console.error('[WORKERS] ❌ Clearing legacy repeatable jobs failed:', err);
    }

    // G2 BOOT KICKSTART (one-shot, NOT a scheduler).
    //
    // After a self-hosted worker restart the process boots fresh, but the external Master Tick may
    // be up to 10 minutes away, so sync would sit idle until then. Seed ONE PERIODIC_PENDING_SYNC
    // tick with a short delay to make recovery near-immediate. This runs only on a persistent
    // worker tier: instrumentation.ts skips initializeBackgroundWorkers entirely when VERCEL=1 or
    // DISABLE_BACKGROUND_WORKERS=true, so the serverless tier (which has no drainer) never sees it.
    //
    // Guarded against double-running with the first external tick two ways:
    //  1. A deterministic per-window job id (`boot-kickstart-<10-min window>`), so two boots inside
    //     the same window collapse to a single queued kickstart.
    //  2. runPendingSyncTick is itself idempotent - its per-RTOM/bucket/daily child jobs use
    //     deterministic ids and its SyncRun windows dedupe - so even if the external tick fires in
    //     the same window, no portal work runs twice.
    // No interval, no repeatable, no cadence change: the external 10-minute tick stays the one clock.
    //
    // Opt-in: WORKER_BOOT_KICKSTART==='true'. Nothing in the current Vercel-only production path
    // sets this flag, so the kickstart is dormant. A future self-hosted worker deploy can enable
    // it explicitly; leaving it off keeps scripts/run-worker.ts on a laptop from seeding a boot tick
    // against a shared queue and becoming a SECOND tick source alongside the external cron.
    if (process.env.WORKER_BOOT_KICKSTART === 'true') {
        try {
            const kickWindow = Math.floor(Date.now() / (10 * 60 * 1000));
            const kickJobId = `boot-kickstart-${kickWindow}`;
            const kick = await enqueueCronJob(sodSyncQueue, 'cron-tick', { type: 'PERIODIC_PENDING_SYNC' }, {
                jobId: kickJobId,
                delay: 15000,
                removeOnComplete: { age: 20 * 60 },
            });
            console.log(kick.accepted
                ? `[WORKERS] Boot kickstart tick seeded (${kickJobId}, +15s) for fast post-restart recovery.`
                : `[WORKERS] Boot kickstart tick NOT accepted (${kickJobId}); the external Master Tick will drive sync.`);
        } catch (err) {
            console.error('[WORKERS] Boot kickstart seed failed:', err);
        }
    } else {
        console.log('[WORKERS] Boot kickstart disabled (set WORKER_BOOT_KICKSTART=true to enable fast post-restart recovery).');
    }

    console.log('[WORKERS] Background system initialization complete');
}

export function shutdownBackgroundWorkers() {
    console.log('[WORKERS] Shutting down background processes...');
    // Workers will close automatically when the process exits
}

// Handle graceful shutdown
if (typeof process !== 'undefined') {
    process.on('SIGTERM', shutdownBackgroundWorkers);
    process.on('SIGINT', shutdownBackgroundWorkers);
}
