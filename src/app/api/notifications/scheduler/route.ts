import { apiHandler } from '@/lib/api-handler';
import { ReminderSchedulerService } from '@/services/notification/reminder-scheduler.service';
import { AppError } from '@/lib/error';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isAuthorized(req: Request): boolean {
    const cronSecret = process.env.CRON_SECRET;
    
    // get searchParams
    const url = new URL(req.url);
    const apiKey = req.headers.get('x-api-key') || url.searchParams.get('key');

    if (cronSecret && apiKey === cronSecret) return true;
    if (process.env.NODE_ENV === 'development') return true;

    return false;
}

const handleSchedulerRequest = async (req: Request) => {
    if (!isAuthorized(req)) {
        throw AppError.unauthorized('Unauthorized: Invalid CRON_SECRET or API Key');
    }

    const url = new URL(req.url);
    const task = url.searchParams.get('task') || 'all';

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
            throw AppError.badRequest(`Unknown task: ${task}`);
    }

    return Response.json({
        success: true,
        task,
        timestamp: new Date().toISOString(),
        results,
    });
};

export const GET = apiHandler(handleSchedulerRequest, { rawResponse: true });
export const POST = apiHandler(handleSchedulerRequest, { rawResponse: true });