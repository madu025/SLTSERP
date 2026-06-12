import { NextResponse } from 'next/server';
import { NotificationService, AppointmentNotificationService } from '@/services/notification.service';

export async function GET(request: Request) {
    try {
        const userId = request.headers.get('x-user-id');
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        // Trigger today's appointments and reminder checks in background
        AppointmentNotificationService.checkAndNotify(userId).catch(err => {
            console.error('Failed to run appointment notification check:', err);
        });

        const notifications = await NotificationService.getUserNotifications(userId);
        return NextResponse.json(notifications);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    try {
        const userId = request.headers.get('x-user-id');
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        await NotificationService.markAllAsRead(userId);
        return NextResponse.json({ success: true });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
