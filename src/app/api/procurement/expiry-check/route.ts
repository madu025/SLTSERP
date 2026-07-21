import { apiHandler } from '@/lib/api-handler';
import { NotificationPolicyService } from '@/services/notification/notification-policy.service';

export const GET = apiHandler(async () => {
    const warnings = await NotificationPolicyService.checkBatchExpirations();
    return Response.json({ success: true, warnings });
});
