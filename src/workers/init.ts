import { CompletedSODSyncService } from '@/services/completed-sod-sync.service';
import { ServiceOrderService } from '@/services/sod.service';
import { AutomationService } from '@/services/automation.service';

/**
 * Background Worker Initialization
 * 
 * This file initializes all background processes when the server starts.
 * It is called by Next.js instrumentation.ts.
 */
export async function initializeBackgroundWorkers() {
    console.log('[WORKERS] Initializing background workers...');

    // 1. Completed SOD Sync (10-minute intervals) - Processes PAT Success portal
    if (process.env.ENABLE_COMPLETED_SOD_SYNC !== 'false') {
        try {
            CompletedSODSyncService.startPeriodicSync();
            console.log('[WORKERS] ✅ Completed SOD Sync (10-min) started');
        } catch (err) {
            console.error('[WORKERS] ❌ Failed to start Completed SOD Sync:', err);
        }
    }

    // 2. Full Automated Sync (10-minute intervals) - Processes Pending portal
    if (process.env.ENABLE_SOD_AUTO_SYNC !== 'false') {
        try {
            // Trigger immediately
            ServiceOrderService.syncAllOpmcs()
                .then(() => console.log('[WORKERS] Initial background pending sync completed'))
                .catch(e => console.error('[WORKERS] Initial pending sync failed:', e));

            // Then every 10 minutes
            setInterval(() => {
                console.log('[WORKERS] Starting background pending sync...');
                ServiceOrderService.syncAllOpmcs().catch(e => console.error('[WORKERS] Periodic pending sync failed:', e));
            }, 10 * 60 * 1000);
            console.log('[WORKERS] ✅ Full Automated Sync (10-min) started');
        } catch (err) {
            console.error('[WORKERS] ❌ Failed to start Full Automated Sync:', err);
        }
    }

    // 3. Global PAT Sync (1-hour intervals) - Processes Rejection portal
    try {
        // Trigger immediately
        ServiceOrderService.syncAllPatResults()
            .then(() => console.log('[WORKERS] Initial global PAT sync completed'))
            .catch(e => console.error('[WORKERS] Initial global PAT sync failed:', e));

        // Then every 1 hour
        setInterval(() => {
            console.log('[WORKERS] Starting global PAT sync (rejections/approvals)...');
            ServiceOrderService.syncAllPatResults().catch(e => console.error('[WORKERS] Periodic global PAT sync failed:', e));
        }, 60 * 60 * 1000);
        console.log('[WORKERS] ✅ Global PAT Sync (1-hour) started');
    } catch (err) {
        console.error('[WORKERS] ❌ Failed to start Global PAT Sync:', err);
    }

    // 4. Daily Automation Tasks (24-hour intervals)
    try {
        // Run every 24 hours
        setInterval(() => {
            console.log('[WORKERS] Running daily automation tasks...');
            AutomationService.runAllDailyTasks().catch(e => console.error('[WORKERS] Daily tasks failed:', e));
        }, 24 * 60 * 60 * 1000);
        console.log('[WORKERS] ✅ Daily Automation Tasks scheduled');
    } catch (err) {
        console.error('[WORKERS] ❌ Failed to schedule Daily Automation Tasks:', err);
    }

    // 4. BullMQ Workers (SOD Import)
    try {
        await import('./import.worker');
        console.log('[WORKERS] ✅ SOD Import Worker (BullMQ) initialized');
    } catch (err) {
        console.error('[WORKERS] ❌ Failed to initialize SOD Import Worker:', err);
    }

    console.log('[WORKERS] All background workers initialized successfully');
}

export function shutdownBackgroundWorkers() {
    console.log('[WORKERS] Shutting down background workers...');
    CompletedSODSyncService.stopPeriodicSync();
    console.log('[WORKERS] All background workers stopped');
}

// Handle graceful shutdown
if (typeof process !== 'undefined') {
    process.on('SIGTERM', shutdownBackgroundWorkers);
    process.on('SIGINT', shutdownBackgroundWorkers);
}
