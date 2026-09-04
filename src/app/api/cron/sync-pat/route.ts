export const dynamic = "force-dynamic";

import { apiHandler } from "@/lib/api-handler";
import { assertCronAuth } from "@/lib/cron-auth";
import { enqueueCronJob } from '@/lib/cron-enqueue';

/**
 * GET /api/cron/sync-pat — enqueue only.
 *
 * HO approved + rejected PAT results are pulled per RTOM, so the run is far longer than any
 * request budget. The worker already owns this as the 30-minute PERIODIC_GLOBAL_SYNC repeatable;
 * this endpoint is the manual/external kick that queues the same job.
 */
export const GET = apiHandler(async (req) => {
    assertCronAuth(req);

    const { sodSyncQueue } = await import('@/lib/queue');
    const { accepted } = await enqueueCronJob(sodSyncQueue, 'periodic-global-sync', { type: 'PERIODIC_GLOBAL_SYNC' });

    console.log(`[CRON] PAT-sync enqueue ${accepted ? 'accepted' : 'LOST'}.`);
    return Response.json({
        success: accepted,
        method: 'queued',
        timestamp: new Date().toISOString(),
    }, { status: accepted ? 200 : 503 });
}, { rawResponse: true });
