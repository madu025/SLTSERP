import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { NotificationService } from '@/services/notification.service';

export async function GET(request: Request) {
    try {
        const userId = request.headers.get('x-user-id');
        
        // Find a target user: either from header or first user in DB
        let targetUserId = userId;
        if (!targetUserId) {
            const firstUser = await prisma.user.findFirst({ select: { id: true } });
            if (firstUser) {
                targetUserId = firstUser.id;
            }
        }

        if (!targetUserId) {
            return NextResponse.json({ error: 'No user found in the database to receive the test notification' }, { status: 404 });
        }

        console.log(`[TEST] Creating test notification for user: ${targetUserId}`);
        
        const notification = await NotificationService.send({
            userId: targetUserId,
            title: "🔔 Test Notification Successful",
            message: `This is a test notification generated at ${new Date().toLocaleTimeString()} to verify the real-time notification bell, sound, and browser push alerts!`,
            type: 'SYSTEM',
            priority: 'HIGH',
            link: '/service-orders'
        });

        return NextResponse.json({ 
            success: true, 
            message: 'Test notification sent successfully!',
            notification 
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
