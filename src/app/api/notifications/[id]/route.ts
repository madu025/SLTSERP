import { apiHandler } from '@/lib/api-handler';
import { NotificationService } from '@/services/notification.service';

export const PATCH = apiHandler(async (_req, params) => {
    const { id } = params;
    await NotificationService.markAsRead(id);
    return Response.json({ success: true });
}, {
    audit: { action: 'MARK_NOTIFICATION_AS_READ', entity: 'Notification' }
});

export const DELETE = apiHandler(async (_req, params) => {
    const { id } = params;
    await NotificationService.delete(id);
    return Response.json({ success: true });
}, {
    audit: { action: 'DELETE_NOTIFICATION', entity: 'Notification' }
});
