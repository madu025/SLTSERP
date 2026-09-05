export const dynamic = 'force-dynamic';
export const maxDuration = 60;
import { apiHandler } from '@/lib/api-handler';
import { assertCronAuth } from '@/lib/cron-auth';
import { ServiceOrderService } from '@/services/service-order/sod.service';

/**
 * Master cron tick - the single endpoint the external scheduler (cron-job.org, every 10 minutes,
 * 24h) is allowed to call.
 *
 * It runs one scheduler tick, and the tick picks its own execution model (see runCronTick):
 * a persistent install enqueues one job and the worker seeds the per-RTOM sweep, the 20/30-minute
 * cadences, the wall-clock dailies and the self-heal from it; a serverless install has no Redis and
 * no worker, so the tick does the work itself within the function budget and resumes from a stored
 * cursor on the next ping.
 *
 * The per-work-item endpoints (/api/cron/sync-pat, /sync-completed, /daily-report-snapshot,
 * /appointment-reminders) still exist, but only as manual kicks. Registering them in a scheduler as
 * well would double the portal calls this tick already covers.
 */
export const GET = apiHandler(async (req) => {
    assertCronAuth(req);

    const startTime = Date.now();
    const tick = await ServiceOrderService.runCronTick();

    const failedItems = Array.isArray(tick.failed) ? (tick.failed as string[]) : [];
    const swept = typeof tick.sweep === 'object' && tick.sweep !== null
        ? Number((tick.sweep as Record<string, unknown>).synced ?? 0)
        : 0;
    const ranTasks = Array.isArray(tick.ran) ? (tick.ran as string[]) : [];
    const didWork = tick.mode === 'queued'
        ? tick.accepted === true
        : swept > 0 || ranTasks.length > 0 || tick.skipped === 'overlap';

    // A queued tick that the queue refused (Redis down or the write rejected) means nothing will
    // run for the next 10 minutes, so it is an outage even when no task threw. Otherwise only a
    // tick that accomplished nothing while throwing is worth alerting on; one slow RTOM out of a
    // ten-RTOM chunk is normal and must not page anyone.
    const queuedButRejected = tick.mode === 'queued' && tick.accepted !== true;
    const status = queuedButRejected || (!didWork && failedItems.length > 0) ? 502 : 200;
    const duration = (Date.now() - startTime) / 1000;
    console.log(`[CRON] Master tick mode=${String(tick.mode)} in ${duration}s -> HTTP ${status}`);

    return Response.json({
        success: status === 200,
        ...tick,
        duration: `${duration}s`,
        timestamp: new Date().toISOString(),
    }, { status });
}, { rawResponse: true });
