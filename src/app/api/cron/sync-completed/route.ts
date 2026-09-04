export const dynamic = 'force-dynamic';

import { apiHandler } from '@/lib/api-handler';
import { assertCronAuth } from '@/lib/cron-auth';
import { enqueueCronJob } from '@/lib/cron-enqueue';

/**
 * GET /api/cron/sync-completed — enqueue only, manual kick.
 *
 * The INSTALL_CLOSED sweep walks several months of portal pages per RTOM; measured work far
 * exceeds what a request handler may hold, so this endpoint only queues the job and returns. The
 * regular trigger is the master tick (/api/cron/sync-all), which seeds the same PERIODIC_COMPLETED_SYNC
 * bucket on a 20-minute cadence. Calling this from a scheduler as well would double the portal work.
 */
export const GET = apiHandler(async (req) => {
    assertCronAuth(req);

    const { sodSyncQueue } = await import('@/lib/queue');
    const { accepted } = await enqueueCronJob(sodSyncQueue, 'periodic-completed-sync', { type: 'PERIODIC_COMPLETED_SYNC' });

    console.log(`[CRON-COMPLETED] Completed-sync enqueue ${accepted ? 'accepted' : 'LOST'}.`);
    // Non-2xx on a lost enqueue so the scheduler itself reports the failure.
    return Response.json({
        success: accepted,
        method: 'queued',
        timestamp: new Date().toISOString(),
    }, { status: accepted ? 200 : 503 });
}, { rawResponse: true });
