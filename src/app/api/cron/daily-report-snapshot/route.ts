export const dynamic = "force-dynamic";

import { apiHandler } from "@/lib/api-handler";
import { assertCronAuth } from "@/lib/cron-auth";
import { enqueueCronJob } from '@/lib/cron-enqueue';

/**
 * GET /api/cron/daily-report-snapshot — enqueue only.
 *
 * Freezing a day aggregates every RTOM, so it runs in the background worker on its own
 * 00:15 Asia/Colombo repeatable (see workers/init.ts). This handler exists for manual re-runs
 * and for the external cron; it hands the work over instead of carrying it, because a
 * request handler cannot hold a full-day recomputation.
 */
export const GET = apiHandler(async (req) => {
    assertCronAuth(req);

    const { systemQueue } = await import('@/lib/queue');
    const { accepted } = await enqueueCronJob(systemQueue, 'daily-report-snapshot', { type: 'DAILY_REPORT_SNAPSHOT' });

    console.log(`[CRON] Daily report snapshot enqueue ${accepted ? 'accepted' : 'LOST'}.`);
    return Response.json({
        success: accepted,
        method: 'queued',
        timestamp: new Date().toISOString(),
    }, { status: accepted ? 200 : 503 });
});
