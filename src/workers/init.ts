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

    const { sodSyncQueue, systemQueue } = await import('../lib/queue');

    // 🚀 INITIALIZE BULLMQ WORKERS
    try {
        await import('./import.worker');
        await import('./sod-sync.worker');
        await import('./stats-update.worker');
        await import('./system.worker');
        console.log('[WORKERS] ✅ All BullMQ Workers (Import, Sync, Stats, System) initialized');
    } catch (err) {
        console.error('[WORKERS] ❌ Worker initialization failed:', err);
    }

    // 🕊️ REGISTER REPEATABLE JOBS (The "One Truth" Scheduler)
    // BullMQ handles redundancy automatically across multiple server instances.
    try {
        // 1. Completed SOD Sync (Every 15 minutes)
        await sodSyncQueue.add(
            'periodic-completed-sync',
            { type: 'PERIODIC_COMPLETED_SYNC' },
            { repeat: { every: 15 * 60 * 1000 }, jobId: 'repeat-completed-sync' }
        );

        // 2. Pending SOD Sync (Every 20 minutes)
        await sodSyncQueue.add(
            'periodic-pending-sync',
            { type: 'PERIODIC_PENDING_SYNC' },
            { repeat: { every: 20 * 60 * 1000 }, jobId: 'repeat-pending-sync' }
        );

        // 3. Global PAT Sync / Rejections (Every 1 hour)
        await sodSyncQueue.add(
            'periodic-global-sync',
            { type: 'PERIODIC_GLOBAL_SYNC' },
            { repeat: { every: 60 * 60 * 1000 }, jobId: 'repeat-global-sync' }
        );

        // 4. Daily Automation (Every 24 hours)
        await systemQueue.add(
            'daily-automation',
            { type: 'DAILY_AUTOMATION' },
            { repeat: { pattern: '0 1 * * *' }, jobId: 'repeat-daily-auto' } // Every day at 1:00 AM
        );

        console.log('[WORKERS] ✅ All Periodic Tasks successfully scheduled in BullMQ');
    } catch (err) {
        console.error('[WORKERS] ❌ Scheduling repeatable jobs failed:', err);
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
