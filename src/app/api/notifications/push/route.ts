import { apiHandler } from '@/lib/api-handler';
import { PushNotificationService } from '@/services/notification/push/push.service';

export const POST = apiHandler(async (request, context, { user }) => {
    const subscription = await request.json();
    await PushNotificationService.saveSubscription(user.id, subscription);
    return { success: true, message: 'Subscription saved' };
});

export const DELETE = apiHandler(async (request, context, { user }) => {
    const { endpoint } = await request.json();
    if (endpoint) {
        await PushNotificationService.removeSubscription(user.id, endpoint);
    }
    return { success: true, message: 'Subscription removed' };
});
