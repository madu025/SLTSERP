/**
 * Background Worker Initialization
 * 
 * This file initializes all background processes when the server starts.
 * Import this in your main server file (e.g., instrumentation.ts or a custom startup file)
 */

import { CompletedSODSyncService } from '@/services/completed-sod-sync.service';

export function initializeBackgroundWorkers() {
    console.log('[WORKERS] Initializing background workers...');

    // Completed SOD Sync (30-minute intervals) - Uses PAT success data
    if (process.env.ENABLE_COMPLETED_SOD_SYNC !== 'false') {
        CompletedSODSyncService.startPeriodicSync();
        console.log('[WORKERS] ✅ Completed SOD Sync started (PAT-based)');
    }

    // SOD Auto-Completion (DISABLED - needs SLT completed endpoint)
    // if (process.env.ENABLE_SOD_AUTO_COMPLETE === 'true') {
    //     SODAutoCompletionService.startBackgroundProcess();
    // }

    // Add other background workers here
    // Example:
    // DailyReportService.start();
    // NotificationCleanupService.start();

    console.log('[WORKERS] All background workers initialized');
}

export function shutdownBackgroundWorkers() {
    console.log('[WORKERS] Shutting down background workers...');

    CompletedSODSyncService.stopPeriodicSync();

    // SODAutoCompletionService.stopBackgroundProcess();

    console.log('[WORKERS] All background workers stopped');
}

// Handle graceful shutdown
if (typeof process !== 'undefined') {
    process.on('SIGTERM', shutdownBackgroundWorkers);
    process.on('SIGINT', shutdownBackgroundWorkers);
}
