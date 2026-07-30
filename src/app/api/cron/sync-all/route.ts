export const dynamic = 'force-dynamic';

import { apiHandler } from '@/lib/api-handler';
import { ServiceOrderService } from '@/services/sod/sod.service';
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

    console.log('[CRON] Starting Master Cron Job...');
    const startTime = Date.now();

    // 1. SOD Sync (Runs every 15 mins)
    const sodResults = await ServiceOrderService.syncAllOpmcs();

    // 2. Appointment Reminders (Runs every 15 mins)
    await AppointmentNotificationService.checkAndNotify();

    // 3. PAT Sync (Runs ONLY once an hour around the 30-minute mark)
    const currentMinute = new Date().getMinutes();
    let patResults = null;
    if (currentMinute >= 25 && currentMinute <= 40) {
        console.log('[CRON] Executing Hourly PAT Sync...');
        const approvedResult = await ServiceOrderService.syncHoApprovedResults();
        const rejectedResult = await ServiceOrderService.syncHoRejectedResults();
        patResults = { approvedResult, rejectedResult };
    }

    const duration = (Date.now() - startTime) / 1000;
    console.log(`[CRON] Master Cron completed in ${duration}s`);

    return Response.json({
        success: true,
        message: 'Master cron completed',
        duration: `${duration}s`,
        stats: sodResults?.stats,
        patSyncRan: !!patResults
    });
});
