import { NextResponse } from 'next/server';
import { apiHandler } from '@/lib/api-handler';
import { NotificationService } from '@/services/notification.service';
import { AppError } from '@/lib/error';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const bulkReadSchema = z.object({
    notificationIds: z.array(z.string()).min(1, 'At least one notification ID required')
});

export const PATCH = apiHandler(async (req: Request) => {
    const userId = req.headers.get('x-user-id');
    if (!userId) throw AppError.unauthorized('Unauthorized');

    const body = await req.json();
    const { notificationIds } = bulkReadSchema.parse(body);

    const { updatedCount, unreadCount } = await NotificationService.markBulkAsRead(userId, notificationIds);

    return NextResponse.json({
        success: true,
        updatedCount,
        unreadCount
    });
});
