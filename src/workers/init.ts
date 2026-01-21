/**
 * Background Worker Initialization
 * 
 * This file initializes all background processes when the server starts.
 * Import this in your main server file (e.g., instrumentation.ts or a custom startup file)
 */

import { SODAutoCompletionService } from '@/services/sod-auto-completion.service';

export function initializeBackgroundWorkers() {
    console.log('[WORKERS] Initializing background workers...');

    // Start SOD Auto-Completion (10-minute intervals)
    if (process.env.ENABLE_SOD_AUTO_COMPLETE !== 'false') {
        SODAutoCompletionService.startBackgroundProcess();
        console.log('[WORKERS] ✅ SOD Auto-Completion started');
    }

    // Add other background workers here
    // Example:
    // DailyReportService.start();
    // NotificationCleanupService.start();

    console.log('[WORKERS] All background workers initialized');
}

export function shutdownBackgroundWorkers() {
    console.log('[WORKERS] Shutting down background workers...');

    SODAutoCompletionService.stopBackgroundProcess();

    console.log('[WORKERS] All background workers stopped');
}

// Handle graceful shutdown
if (typeof process !== 'undefined') {
    process.on('SIGTERM', shutdownBackgroundWorkers);
    process.on('SIGINT', shutdownBackgroundWorkers);
}
