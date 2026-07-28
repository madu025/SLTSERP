import { apiHandler } from '@/lib/api-handler';
import { PushNotificationService } from '@/services/notification/push/push.service';

export const POST = apiHandler(async (request, params, body) => {
    const userId = params._userId || request.headers.get('x-user-id') || 'system';
    await PushNotificationService.saveSubscription(userId, body as any);
    return { success: true, message: 'Subscription saved' };
});

export const DELETE = apiHandler(async (request, params, body) => {
    const userId = params._userId || request.headers.get('x-user-id') || 'system';
    const { endpoint } = body || {};
    if (endpoint) {
        await PushNotificationService.removeSubscription(userId, endpoint as string);
    }
    return { success: true, message: 'Subscription removed' };
});
