export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes for large datasets

import { apiHandler } from '@/lib/api-handler';
import { CompletedSODSyncService } from '@/services/service-order/completed-sod-sync.service';
import { assertCronAuth } from '@/lib/cron-auth';

/**
 * GET /api/cron/sync-completed
 * Syncs all INSTALL_CLOSED SODs from the SLT portal.
 * Designed to be called by cron-job.org every 30 minutes.
 * Serves as the authoritative source for INSTALL_CLOSED counts.
 */
export const GET = apiHandler(async (req) => {
    assertCronAuth(req);

    console.log('[CRON-COMPLETED] Starting Completed SOD Sync...');
    const startTime = Date.now();

    try {
        const result = await CompletedSODSyncService.syncCompletedSODs();

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`[CRON-COMPLETED] Completed in ${duration}s: ${result.completed} completed, ${result.enriched} enriched, ${result.errors.length} errors`);

        return {
            success: true,
            message: 'Completed SOD sync finished',
            duration: `${duration}s`,
            data: {
                checked: result.checked,
                completed: result.completed,
                enriched: result.enriched,
                errorCount: result.errors.length,
                errors: result.errors.slice(0, 10) // Return first 10 errors max
            }
        };
    } catch (error) {
        console.error('[CRON-COMPLETED] Fatal error:', error);
        throw error;
    }
});
