export const dynamic = 'force-dynamic';
import { apiHandler } from '@/lib/api-handler';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { PushNotificationService } from '@/services/notification/push/push.service';

export const POST = apiHandler(async (request, params, body) => {
    const cookieStore = await cookies();
    const endpoint = (body as { endpoint?: string })?.endpoint;
    const userId = params?._userId;

    if (endpoint && userId) {
        await PushNotificationService.removeSubscription(userId, endpoint);
    } else if (userId) {
        await prisma.pushSubscription.deleteMany({
            where: { userId },
        }).catch(() => {});
    }

    const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax' as const,
        maxAge: 0, // Expire immediately
        path: '/',
    };

    // Clear the access token cookie
    cookieStore.set('token', '', cookieOptions);
    // Clear the refresh token cookie
    cookieStore.set('refresh_token', '', cookieOptions);

    return NextResponse.json({
        success: true,
        message: 'Logged out successfully'
    });
}, { roles: ['ALL'] });

