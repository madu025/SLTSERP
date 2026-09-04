export const dynamic = 'force-dynamic';

import { apiHandler } from '@/lib/api-handler';
import { ServiceOrderService } from '@/services/service-order/sod.service';
import { assertCronAuth } from '@/lib/cron-auth';
import { enqueueCronJob } from '@/lib/cron-enqueue';

/**
 * GET /api/cron/sync-sod
 * Enqueues per-RTOM sync jobs for one OPMC slice; the background worker does the portal work.
 * `syncAllOpmcs` is enqueue-only, so this handler stays cheap regardless of slice size.
 */
export const GET = apiHandler(async (req) => {
    assertCronAuth(req);
    const { searchParams } = new URL(req.url);

    const offset = parseInt(searchParams.get('offset') || '0');
    const limit = parseInt(searchParams.get('limit') || '15');

    console.log(`[CRON] Starting Automated SOD Sync (offset=${offset}, limit=${limit}) at ${new Date().toISOString()}...`);

    const syncResult = await ServiceOrderService.syncAllOpmcs(offset, limit);

    // Daily automation runs on the worker's own repeatable; queue it rather than holding the request.
    let automationResults = null;
    const runDailyTasks = searchParams.get('tasks') === 'daily';
    if (runDailyTasks) {
        const { systemQueue } = await import('@/lib/queue');
        automationResults = await enqueueCronJob(systemQueue, 'daily-automation', { type: 'DAILY_AUTOMATION' });
    }

    return Response.json({
        success: syncResult.success,
        timestamp: new Date().toISOString(),
        sync: syncResult,
        automation: automationResults
    }, { status: syncResult.success ? 200 : 503 });
}, { rawResponse: true });
