export const dynamic = 'force-dynamic';

import { apiHandler } from '@/lib/api-handler';
import { assertCronAuth } from '@/lib/cron-auth';
import { enqueueCronJob } from '@/lib/cron-enqueue';

/**
 * GET /api/cron/sync-completed — enqueue only.
 *
 * The INSTALL_CLOSED sweep walks several months of portal pages per RTOM; measured work far
 * exceeds what a request handler may hold, which is why the same sync already runs as the
 * worker's 20-minute PERIODIC_COMPLETED_SYNC repeatable. This endpoint is the manual/external
 * kick: it queues the job and returns.
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
});
