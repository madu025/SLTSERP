export const dynamic = 'force-dynamic';

import { apiHandler } from '@/lib/api-handler';
import { AppointmentNotificationService } from '@/services/notification/notification.service';
import { assertCronAuth } from '@/lib/cron-auth';

export const GET = apiHandler(async (req) => {
    assertCronAuth(req);

    console.log('[CRON] Initiating appointment reminder sweep...');
    await AppointmentNotificationService.checkAndNotify();
    console.log('[CRON] Appointment reminder sweep completed successfully');

    return Response.json({ success: true });
});
