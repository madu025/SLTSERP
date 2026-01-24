/* eslint-disable @typescript-eslint/no-explicit-any */
import { Worker, Job } from 'bullmq';
import { redis } from '../lib/redis';
import { QUEUE_NAMES } from '../lib/queue';
import { ServiceOrderService } from '../services/sod.service';

export const sodSyncWorker = new Worker(
    QUEUE_NAMES.SOD_SYNC,
    async (job: Job) => {
        const { opmcId, rtom } = job.data as {
            opmcId: string;
            rtom: string;
        };

        try {
            console.log(`[SOD-SYNC-WORKER] Starting sync for RTOM: ${rtom} (Job ID: ${job.id})`);
            const result = await ServiceOrderService.syncServiceOrders(opmcId, rtom);
            console.log(`[SOD-SYNC-WORKER] Completed RTOM: ${rtom}. Created: ${result.created}, Updated: ${result.updated}`);
            return result;
        } catch (err) {
            console.error(`[SOD-SYNC-WORKER] Failed to sync RTOM: ${rtom}`, err);
            throw err;
        }
    },
    {
        connection: redis as any,
        concurrency: 2 // Run 2 sync jobs simultaneously as requested
    }
);

console.log('✅ SOD Sync Worker initialized (Concurrency: 2)');
