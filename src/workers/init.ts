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
