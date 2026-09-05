 
process.env.IS_WORKER = 'true';
import { Worker, Job } from 'bullmq';
import { createQueueConnection } from '../lib/redis-queue';
import { QUEUE_NAMES } from '../lib/queue';
import { AutomationService } from '../services/automation/automation.service';

/**
 * System Worker
 * Handles miscellaneous background tasks like daily automation, 
 * cleanup, and other system-wide maintenance.
 */
export const systemWorker = new Worker(
    QUEUE_NAMES.SYSTEM,
    async (job: Job) => {
        const { type } = job.data as { type: string };

        try {
            if (type === 'DAILY_AUTOMATION') {
                console.log(`[SYSTEM-WORKER] Running daily automation tasks... (Job ID: ${job.id})`);
                await AutomationService.runAllDailyTasks();
                console.log(`[SYSTEM-WORKER] Daily automation tasks completed.`);
            } else if (type === 'APPOINTMENT_REMINDERS') {
                // Appointment sweep moved out of /api/cron/sync-all: it read from our own tables
                // inside a request handler, so it only ever ran when an external cron pinged the URL.
                console.log(`[SYSTEM-WORKER] Running appointment reminder sweep... (Job ID: ${job.id})`);
                const { AppointmentNotificationService } = await import('../services/notification/appointment-notification.service');
                await AppointmentNotificationService.checkAndNotify();
                console.log(`[SYSTEM-WORKER] Appointment reminder sweep completed.`);
            } else if (type === 'NOTIFICATION_CLEANUP') {
                console.log(`[SYSTEM-WORKER] Running notification cleanup... (Job ID: ${job.id})`);
                const { NotificationService } = await import('../services/notification/notification.service');
                const result = await NotificationService.cleanup();
                console.log(`[SYSTEM-WORKER] Notification cleanup removed ${result.count} row(s).`);
            } else if (type === 'DAILY_REPORT_SNAPSHOT') {
                // End-of-day close for the Daily Operational Report. The sweep runs here rather than
                // in the request handler so a 10-minute cron ping only has to enqueue it.
                console.log(`[SYSTEM-WORKER] Freezing daily report snapshot... (Job ID: ${job.id})`);
                const { ReportService } = await import('../services/core/report.service');
                const result = await ReportService.persistClosedSriLankaDaySnapshot();
                console.log(`[SYSTEM-WORKER] Daily report snapshot frozen for ${result.dateKey} (${result.rows} rows).`);
            } else {
                console.warn(`[SYSTEM-WORKER] Unknown job type: ${type}`);
            }
        } catch (err) {
            console.error(`[SYSTEM-WORKER] ❌ Error in job ${job.id} (${type}):`, err);
            throw err;
        }
    },
    {
        connection: createQueueConnection('worker:system'),
        concurrency: 1
    }
);

console.log('✅ System Worker initialized');
