import { NextResponse } from 'next/server';
import { NotificationService } from '@/services/notification.service';
import { prisma } from '@/lib/prisma';

/**
 * API Route for Scheduled Notification Cleanup
 * This can be triggered by a CRON job (e.g., GitHub Actions, Vercel Cron, or a system cron)
 * Route: /api/notifications/cleanup
 */
export async function POST(request: Request) {
    try {
        // Optional: Check for an API Key or Secret to prevent unauthorized cleanup calls
        const authHeader = request.headers.get('authorization');
        const internalSecret = process.env.CRON_SECRET;

        if (internalSecret && authHeader !== `Bearer ${internalSecret}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const result = await NotificationService.cleanup();

        return NextResponse.json({
            message: 'Notification cleanup completed successfully',
            deletedCount: result.count,
            timestamp: new Date().toISOString()
        });
    } catch (error: any) {
        console.error('Cleanup operation failed:', error);
        return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
    }
}

// Allow GET for testing or simple triggers if needed, but POST is safer
export async function GET(request: Request) {
    return POST(request);
}
