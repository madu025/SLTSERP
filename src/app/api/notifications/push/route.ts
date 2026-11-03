export const dynamic = 'force-dynamic';
import { apiHandler } from '@/lib/api-handler';
import { PushNotificationService } from '@/services/notification/push/push.service';
import { z } from 'zod';
import { AppError } from '@/lib/error';

const pushSubscriptionSchema = z.object({
    endpoint: z.string().url().max(2048),
    keys: z.object({
        p256dh: z.string().min(20).max(512),
        auth: z.string().min(8).max(512),
    }).strict(),
}).strict();
const removeSubscriptionSchema = z.object({ endpoint: z.string().url().max(2048) }).strict();

export const POST = apiHandler(async (request, params, body) => {
    const userId = params._userId;
    if (!userId) throw AppError.unauthorized('Authenticated user required');
    await PushNotificationService.saveSubscription(userId, pushSubscriptionSchema.parse(body));
    return { success: true, message: 'Subscription saved' };
});

export const DELETE = apiHandler(async (request, params, body) => {
    const userId = params._userId;
    if (!userId) throw AppError.unauthorized('Authenticated user required');
    const { endpoint } = removeSubscriptionSchema.parse(body);
    await PushNotificationService.removeSubscription(userId, endpoint);
    return { success: true, message: 'Subscription removed' };
});
