export const dynamic = 'force-dynamic';
import { ROLE_GROUPS } from '@/config/roles';
import { apiHandler } from '@/lib/api-handler';
import { ServiceOrderService } from '@/services/service-order/sod.service';

// This endpoint allows admins to manually trigger the sync process.
export const POST = apiHandler(async () => {
    // Same entry point the external clock uses, so the button cannot drift from the scheduler:
    // a persistent install seeds the queue and returns, a serverless install runs one bounded
    // inline tick and resumes from its stored cursor. Hand-slicing OPMCs here would only ever
    // work on one of the two hosts.
    const tick = await ServiceOrderService.runCronTick();
    const failedItems = Array.isArray(tick.failed) ? (tick.failed as string[]) : [];
    const queuedButRejected = tick.mode === 'queued' && tick.accepted !== true;
    const status = queuedButRejected || failedItems.length > 0 ? 502 : 200;

    return Response.json({
        success: status === 200,
        mode: tick.mode,
        message: status !== 200
            ? 'Tick started but reported failures - inspect the stats before trusting the view'
            : tick.mode === 'queued'
                ? 'Manual sync seeded to the background queue'
                : 'Manual sync executed inline (serverless tick)',
        tick
    }, { status });
}, {
    roles: ROLE_GROUPS.ADMINS,
    audit: { action: 'TRIGGER_MANUAL_SYNC', entity: 'Admin' },
    rawResponse: true
});
