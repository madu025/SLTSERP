/* eslint-disable @typescript-eslint/no-explicit-any */
process.env.IS_WORKER = 'true';
import { Worker, Job } from 'bullmq';
import { redis } from '../lib/redis';
import { QUEUE_NAMES } from '../lib/queue';
import { AutomationService } from '../services/automation.service';

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
            } else {
                console.warn(`[SYSTEM-WORKER] Unknown job type: ${type}`);
            }
        } catch (err) {
            console.error(`[SYSTEM-WORKER] ❌ Error in job ${job.id} (${type}):`, err);
            throw err;
        }
    },
    {
        connection: redis as any,
        concurrency: 1
    }
);

console.log('✅ System Worker initialized');
