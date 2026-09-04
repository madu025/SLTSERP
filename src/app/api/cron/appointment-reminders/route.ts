export const dynamic = 'force-dynamic';

import { apiHandler } from '@/lib/api-handler';
import { assertCronAuth } from '@/lib/cron-auth';
import { enqueueCronJob } from '@/lib/cron-enqueue';

/**
 * GET /api/cron/appointment-reminders — enqueue only.
 *
 * The sweep itself lives in the system worker, which also runs it daily at 05:45
 * Asia/Colombo (workers/init.ts). This endpoint is only a manual/external kick.
 */
export const GET = apiHandler(async (req) => {
    assertCronAuth(req);

    const { systemQueue } = await import('@/lib/queue');
    const { accepted } = await enqueueCronJob(systemQueue, 'appointment-reminders', { type: 'APPOINTMENT_REMINDERS' });

    console.log(`[CRON] Appointment-reminder enqueue ${accepted ? 'accepted' : 'LOST'}.`);
    return Response.json({
        success: accepted,
        method: 'queued',
        timestamp: new Date().toISOString(),
    }, { status: accepted ? 200 : 503 });
}, { rawResponse: true });
