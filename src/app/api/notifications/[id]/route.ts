import { getAuthenticatedUserId } from '@/lib/request-context';
export const dynamic = 'force-dynamic';
import { apiHandler } from '@/lib/api-handler';
import { NotificationService } from '@/services/notification/notification.service';

export const PATCH = apiHandler(async (_req, params) => {
    const { id } = params;
    const userId = getAuthenticatedUserId();
    if (!userId) {
        return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    // Only the owner can mark a notification as read
    await NotificationService.markAsRead(id, userId);
    return Response.json({ success: true });
}, {
    audit: { action: 'MARK_NOTIFICATION_AS_READ', entity: 'Notification' }
});

export const DELETE = apiHandler(async (req, params) => {
    const { id } = params;
    const userId = getAuthenticatedUserId();
    if (!userId) {
        return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    await NotificationService.delete(id, userId);
    return Response.json({ success: true });
}, {
    audit: { action: 'DELETE_NOTIFICATION', entity: 'Notification' }
});
