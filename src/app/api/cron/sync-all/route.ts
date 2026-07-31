export const dynamic = 'force-dynamic';
export const maxDuration = 300; // Allow up to 5 minutes on Vercel Pro (60s on Hobby)
import { apiHandler } from '@/lib/api-handler';
import { AppointmentNotificationService } from '@/services/notification/notification.service';
import { AppError } from '@/lib/error';

/**
 * Scheduled Sync for all Service Orders from SLT API
 * Can be triggered by a Cron Job service (e.g., Vercel Cron, GitHub Actions)
 */
export const GET = apiHandler(async (req) => {
    const { searchParams } = new URL(req.url);

    // Basic Security: Check for Cron Secret
    const secret = req.headers.get('authorization')?.replace('Bearer ', '') || searchParams.get('secret');
    if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
        throw AppError.unauthorized('Unauthorized: Invalid CRON_SECRET');
    }

    console.log('[CRON] Starting Master Cron Job (Enqueueing to Background Workers)...');
    const startTime = Date.now();

    const { addJob, sodSyncQueue } = await import('@/lib/queue');

    // 1. SOD Sync
    if (process.env.VERCEL) {
        console.log('[CRON] Vercel environment detected. Executing SOD Sync synchronously...');
        const { ServiceOrderService } = await import('@/services/sod/sod.service');
        await ServiceOrderService.syncAllOpmcs();
        console.log('[CRON] Synchronous SOD Sync completed.');
    } else {
        await addJob(sodSyncQueue, 'periodic-pending-sync', { type: 'PERIODIC_PENDING_SYNC' });
        console.log('[CRON] Enqueued SOD Sync Job');
    }

    // 2. Appointment Reminders
    await AppointmentNotificationService.checkAndNotify();

    // 3. PAT Sync (Runs ONLY once an hour around the 30-minute mark)
    const currentMinute = new Date().getMinutes();
    let patSyncEnqueued = false;
    if (currentMinute >= 25 && currentMinute <= 40) {
        if (process.env.VERCEL) {
            console.log('[CRON] Executing Hourly PAT Sync synchronously...');
            const { ServiceOrderService } = await import('@/services/sod/sod.service');
            await ServiceOrderService.syncHoApprovedResults();
            await ServiceOrderService.syncHoRejectedResults();
            console.log('[CRON] Synchronous PAT Sync completed.');
        } else {
            console.log('[CRON] Enqueueing Hourly PAT Sync...');
            await addJob(sodSyncQueue, 'periodic-global-sync', { type: 'PERIODIC_GLOBAL_SYNC' });
            patSyncEnqueued = true;
        }
    }

    const duration = (Date.now() - startTime) / 1000;
    console.log(`[CRON] Master Cron executed in ${duration}s`);

    return Response.json({
        success: true,
        message: 'Master cron tasks successfully enqueued to background workers',
        duration: `${duration}s`,
        patSyncEnqueued

    });
});
