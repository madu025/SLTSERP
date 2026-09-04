export const dynamic = 'force-dynamic';
import { ROLE_GROUPS } from '@/config/roles';
import { apiHandler } from '@/lib/api-handler';
import { ServiceOrderService } from '@/services/service-order/sod.service';

// This endpoint allows admins to manually trigger the sync process.
export const POST = apiHandler(async () => {
    // Enqueue only: this handler writes 43 queue jobs and returns. The background worker performs
    // the portal calls (7-13s per RTOM), which no request budget can carry. limit=0 means every
    // OPMC, not the historical 15-OPMC slice used by the chunked cron.
    const result = await ServiceOrderService.syncAllOpmcs(0, 0);

    return Response.json({
        success: result.success,
        message: result.success
            ? 'Manual sync enqueued to background workers'
            : 'Some sync jobs were not accepted by the queue (Redis unavailable) - no worker will run them',
        stats: result.stats
    }, { status: result.success ? 200 : 503 });
}, {
    roles: ROLE_GROUPS.ADMINS,
    audit: { action: 'TRIGGER_MANUAL_SYNC', entity: 'Admin' }
});
