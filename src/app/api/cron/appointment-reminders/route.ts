import { NextResponse } from 'next/server';
import { AppointmentNotificationService } from '@/services/notification.service';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const secret = searchParams.get('secret');

        // Optional basic security check using CRON_SECRET env variable
        if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        console.log('[CRON] Initiating appointment reminder sweep...');
        await AppointmentNotificationService.checkAndNotify();
        console.log('[CRON] Appointment reminder sweep completed successfully');

        return NextResponse.json({ success: true });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
