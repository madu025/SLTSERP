/**
 * Notification Scheduler API
 * Cron endpoint for running scheduled notification tasks.
 * Call via GET /api/notifications/scheduler?task=all|hourly|cleanup
 * Protected by API key or cron secret.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ReminderSchedulerService } from '@/services/notification/reminder-scheduler.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isAuthorized(req: NextRequest): boolean {
    const cronSecret = process.env.CRON_SECRET;
    const apiKey = req.headers.get('x-api-key') || req.nextUrl.searchParams.get('key');

    // Allow cron jobs with secret auth
    if (cronSecret && apiKey === cronSecret) return true;

    // In development, allow unauthenticated access
    if (process.env.NODE_ENV === 'development') return true;

    return false;
}

export async function GET(req: NextRequest) {
    if (!isAuthorized(req)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const task = url.searchParams.get('task') || 'all';

    try {
        let results;

        switch (task) {
            case 'all':
                results = await ReminderSchedulerService.runAll();
                break;
            case 'hourly':
                results = await ReminderSchedulerService.runHourly();
                break;
            case 'cleanup':
                const days = parseInt(url.searchParams.get('days') || '30', 10);
                results = await ReminderSchedulerService.cleanupOldNotifications(days);
                break;
            case 'appointments':
                results = [await ReminderSchedulerService.checkAppointmentReminders()];
                break;
            case 'tasks':
                results = [await ReminderSchedulerService.checkTaskDueDates()];
                break;
            case 'milestones':
                results = [await ReminderSchedulerService.checkMilestoneDueDates()];
                break;
            case 'escalations':
                results = [await ReminderSchedulerService.checkNotificationEscalations()];
                break;
            case 'digest':
                results = [await ReminderSchedulerService.sendDailyDigests()];
                break;
            default:
                return NextResponse.json({ error: `Unknown task: ${task}` }, { status: 400 });
        }

        return NextResponse.json({
            success: true,
            task,
            timestamp: new Date().toISOString(),
            results,
        });
    } catch (error: any) {
        console.error(`[Scheduler API] Task ${task} failed:`, error);
        return NextResponse.json(
            {
                success: false,
                task,
                error: error?.message || 'Unknown error',
                timestamp: new Date().toISOString(),
            },
            { status: 500 },
        );
    }
}

// POST for Vercel Cron compatibility
export async function POST(req: NextRequest) {
    return GET(req);
}