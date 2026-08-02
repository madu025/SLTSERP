export const dynamic = 'force-dynamic';
import { apiHandler } from '@/lib/api-handler';
import { NotificationService } from '@/services/notification/notification.service';

export const PATCH = apiHandler(async (_req, params) => {
    const { id } = params;
    await NotificationService.markAsRead(id);
    return Response.json({ success: true });
}, {
    audit: { action: 'MARK_NOTIFICATION_AS_READ', entity: 'Notification' }
});

export const DELETE = apiHandler(async (req, params) => {
    const { id } = params;
    const userId = req.headers.get("x-user-id");
    if (!userId) {
        return Response.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }
    await NotificationService.delete(id, userId);
    return Response.json({ success: true });
}, {
    audit: { action: 'DELETE_NOTIFICATION', entity: 'Notification' }
});
