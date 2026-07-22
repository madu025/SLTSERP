import { NextResponse } from 'next/server';
import { apiHandler } from '@/lib/api-handler';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { AppError } from '@/lib/error';
import { z } from 'zod';

const bulkReadSchema = z.object({
    notificationIds: z.array(z.string()).min(1, 'At least one notification ID required')
});

export const PATCH = apiHandler(async (req: Request) => {
    const userId = req.headers.get('x-user-id');
    if (!userId) throw AppError.unauthorized('Unauthorized');

    const body = await req.json();
    const { notificationIds } = bulkReadSchema.parse(body);

    // Single DB Transaction: Mark all specified IDs as read for this user
    const result = await prisma.notification.updateMany({
        where: {
            id: { in: notificationIds },
            userId
        },
        data: {
            isRead: true
        }
    });

    // Recalculate remaining unread count
    const remainingUnread = await prisma.notification.count({
        where: {
            userId,
            isRead: false
        }
    });

    // Sync Redis counter
    try {
        await redis.set(`unread:${userId}`, remainingUnread.toString());
    } catch (err) {
        console.error('Failed to sync Redis unread counter:', err);
    }

    return NextResponse.json({
        success: true,
        updatedCount: result.count,
        unreadCount: remainingUnread
    });
});
