 
process.env.IS_WORKER = 'true';
import { Worker, Job } from 'bullmq';
import { createQueueConnection } from '../lib/redis-queue';
import { QUEUE_NAMES } from '../lib/queue';
import { AppError } from '@/lib/error';
import type { DailyJobType } from '@/services/service-order/sync/types';

/**
 * System Worker
 * -------------
 * Wall-clock maintenance jobs (daily automation, appointment sweep, retention, report snapshot).
 * They are queued by the master tick's TICK_DAILY_JOBS, which decides *when*; this file only
 * decides *what runs* for a given job type.
 */
type SystemJobData = { type?: DailyJobType };

/**
 * One handler per job type, typed so a new DailyJobType is a compile error rather than a silent
 * fallthrough (defect O9). The previous if/else chain ended in `console.warn('Unknown job type')`
 * and acknowledged the job, so a mistyped or renamed payload looked like a completed run in the
 * logs while doing nothing.
 */
const HANDLERS: Record<DailyJobType, (job: Job<SystemJobData>) => Promise<unknown>> = {
    DAILY_AUTOMATION: async () => {
        const { AutomationService } = await import('@/services/automation/automation.service');
        return AutomationService.runAllDailyTasks();
    },

    APPOINTMENT_REMINDERS: async () => {
        // Moved out of /api/cron/sync-all: it reads our own tables, so it only ever belongs in a worker.
        const { AppointmentNotificationService } = await import('@/services/notification/appointment-notification.service');
        return AppointmentNotificationService.checkAndNotify();
    },

    NOTIFICATION_CLEANUP: async () => {
        // The body lives in SODSyncService.runDailyTask so the queue path and the serverless inline
        // path cannot diverge on what a pass is, or on whether it is censused.
        const { SODSyncService } = await import('@/services/service-order/sod.sync.service');
        const result = await SODSyncService.runDailyTask('NOTIFICATION_CLEANUP');
        if (!result) return { skipped: 'window-owned' };
        return result;
    },

    DAILY_REPORT_SNAPSHOT: async () => {
        // End-of-day close for the Daily Operational Report. The sweep runs here rather than in the
        // request handler so a 10-minute cron ping only has to enqueue it.
        const { SODSyncService } = await import('@/services/service-order/sod.sync.service');
        const result = await SODSyncService.runDailyTask('DAILY_REPORT_SNAPSHOT');
        if (!result) return { skipped: 'window-owned' };
        return result;
    },
};

export const systemWorker = new Worker(
    QUEUE_NAMES.SYSTEM,
    async (job: Job<SystemJobData>) => {
        const { type } = job.data ?? {};
        const handler = type ? HANDLERS[type] : undefined;

        if (!type || !handler) {
            // Fail loudly: the job lands in the failed set with the offending type in the message
            // instead of being acknowledged as if it had worked.
            throw AppError.badRequest(`SYSTEM_WORKER_UNKNOWN_JOB_TYPE: ${String(type)}`);
        }

        console.log(`[SYSTEM-WORKER] Running ${type}... (Job ID: ${job.id})`);
        try {
            const result = await handler(job);
            console.log(`[SYSTEM-WORKER] ${type} completed.`);
            return result;
        } catch (err) {
            console.error(`[SYSTEM-WORKER] Error in job ${job.id} (${type}):`, err);
            throw err;
        }
    },
    {
        connection: createQueueConnection('worker:system'),
        concurrency: 1
    }
);

console.log('System Worker initialized');
