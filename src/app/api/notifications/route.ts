import { apiHandler } from '@/lib/api-handler';
import { NotificationService, AppointmentNotificationService } from '@/services/notification.service';
import { OpmcService } from '@/services/opmc.service';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (request) => {
    const userId = request.headers.get('x-user-id');
    if (!userId) throw AppError.unauthorized('Unauthorized');

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    // Trigger today's appointments and reminder checks in background
    AppointmentNotificationService.checkAndNotify(userId).catch(err => {
        console.error('Failed to run appointment notification check:', err);
    });

    const notifications = await NotificationService.getUserNotifications(userId, limit);
    return notifications;
}, { rawResponse: true });

export const PATCH = apiHandler(async (request) => {
    const userId = request.headers.get('x-user-id');
    if (!userId) throw AppError.unauthorized('Unauthorized');

    const { searchParams } = new URL(request.url);
    const link = searchParams.get('link');
    const linkPrefix = searchParams.get('linkPrefix');
    const type = searchParams.get('type');
    let opmcId = searchParams.get('opmcId');
    const rtom = searchParams.get('rtom');

    if (rtom) {
        const allOpmcs = await OpmcService.getAllOPMCs();
        const foundOpmc = allOpmcs.find(o => o.rtom === rtom);
        if (foundOpmc) {
            opmcId = foundOpmc.id;
        }
    }

    if (linkPrefix) {
        await NotificationService.markLinkPrefixAsRead(userId, linkPrefix);
    } else if (link) {
        await NotificationService.markLinkAsRead(userId, link, opmcId);
    } else if (type) {
        await NotificationService.markTypeAsRead(userId, type);
    } else {
        await NotificationService.markAllAsRead(userId);
    }
    return { success: true };
});

export const DELETE = apiHandler(async (request) => {
    const userId = request.headers.get('x-user-id');
    if (!userId) throw AppError.unauthorized('Unauthorized');

    await NotificationService.deleteAll(userId);
    return { success: true };
}, {
    audit: {
        action: 'DELETE',
        entity: 'Notification'
    }
});
