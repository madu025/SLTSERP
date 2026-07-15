import { apiHandler } from '@/lib/api-handler';
import { NotificationService } from '@/services/notification.service';

import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export const PATCH = apiHandler(async (request, context, { user }) => {
    const { searchParams } = new URL(request.url);
    const link = searchParams.get('link');
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

    if (link) {
        await NotificationService.markLinkAsRead(user.id, link, opmcId);
    } else if (type) {
        await NotificationService.markTypeAsRead(user.id, type);
    } else {
        await NotificationService.markAllAsRead(user.id);
    }
    return { success: true };
});

export const DELETE = apiHandler(async (request, context, { user }) => {
    await NotificationService.deleteAll(user.id);
    return { success: true };
}, {
    audit: {
        action: 'DELETE',
        entity: 'Notification'
    }
});
