import { apiHandler } from '@/lib/api-handler';
import { NotificationService } from '@/services/notification.service';

import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export const PATCH = apiHandler(async (request) => {
    const userId = request.headers.get('x-user-id');
    if (!userId) return new Response('Unauthorized', { status: 401 });

    const { searchParams } = new URL(request.url);
    const link = searchParams.get('link');
    const linkPrefix = searchParams.get('linkPrefix');
    const type = searchParams.get('type');
    let opmcId = searchParams.get('opmcId');
    const rtom = searchParams.get('rtom');

    if (rtom) {
        const opmc = await prisma.oPMC.findUnique({
            where: { rtom },
            select: { id: true }
        });
        if (opmc) {
            opmcId = opmc.id;
        }
    }

    if (linkPrefix) {
        await prisma.notification.updateMany({
            where: { userId, link: { startsWith: linkPrefix }, isRead: false },
            data: { isRead: true }
        });
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
    if (!userId) return new Response('Unauthorized', { status: 401 });
    
    await NotificationService.deleteAll(userId);
    return { success: true };
}, {
    audit: {
        action: 'DELETE',
        entity: 'Notification'
    }
});
