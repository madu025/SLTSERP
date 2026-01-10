import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET: Fetch notifications for a user
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');
        const unreadOnly = searchParams.get('unreadOnly') === 'true';

        if (!userId) {
            return NextResponse.json({ error: "userId required" }, { status: 400 });
        }

        const where: any = { userId };
        if (unreadOnly) {
            where.read = false;
        }

        const notifications = await prisma.notification.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: 50 // Limit to last 50 notifications
        });

        return NextResponse.json(notifications);
    } catch (error) {
        console.error("Error fetching notifications:", error);
        return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 });
    }
}

// POST: Create a new notification
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { userId, type, title, message, link } = body;

        if (!userId || !type || !title || !message) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const notification = await prisma.notification.create({
            data: {
                userId,
                type,
                title,
                message,
                link: link || null
            }
        });

        return NextResponse.json(notification);
    } catch (error) {
        console.error("Error creating notification:", error);
        return NextResponse.json({ error: "Failed to create notification" }, { status: 500 });
    }
}

// PATCH: Mark notification(s) as read
export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        const { notificationId, userId, markAllRead } = body;

        if (markAllRead && userId) {
            // Mark all notifications as read for user
            await prisma.notification.updateMany({
                where: { userId, read: false },
                data: { read: true }
            });
            return NextResponse.json({ success: true });
        }

        if (notificationId) {
            // Mark single notification as read
            const updated = await prisma.notification.update({
                where: { id: notificationId },
                data: { read: true }
            });
            return NextResponse.json(updated);
        }

        return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    } catch (error) {
        console.error("Error updating notification:", error);
        return NextResponse.json({ error: "Failed to update notification" }, { status: 500 });
    }
}

// DELETE: Delete a notification
export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: "Notification ID required" }, { status: 400 });
        }

        await prisma.notification.delete({
            where: { id }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error deleting notification:", error);
        return NextResponse.json({ error: "Failed to delete notification" }, { status: 500 });
    }
}
