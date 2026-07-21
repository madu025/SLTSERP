import { apiHandler } from '@/lib/api-handler';
import { AppointmentNotificationService } from '@/services/notification.service';
import { AppError } from '@/lib/error';

export const GET = apiHandler(async (req) => {
    const { searchParams } = new URL(req.url);
    const secret = searchParams.get('secret');

    if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
        throw AppError.unauthorized('Unauthorized: Invalid CRON_SECRET');
    }

    console.log('[CRON] Initiating appointment reminder sweep...');
    await AppointmentNotificationService.checkAndNotify();
    console.log('[CRON] Appointment reminder sweep completed successfully');

    return Response.json({ success: true });
});
