/* eslint-disable @typescript-eslint/no-explicit-any */
import { Worker, Job } from 'bullmq';
import { redis } from '../lib/redis';
import { QUEUE_NAMES } from '../lib/queue';
import { ServiceOrderService } from '../services/sod.service';
import { SLTPATData } from '../services/slt-api.service';

export const sodSyncWorker = new Worker(
    QUEUE_NAMES.SOD_SYNC,
    async (job: Job) => {
        const { opmcId, rtom, type, hoRejected } = job.data as {
            opmcId: string;
            rtom: string;
            type?: 'PENDING' | 'PAT_REJECTION';
            hoRejected?: SLTPATData[];
        };

        try {
            if (type === 'PAT_REJECTION') {
                console.log(`[SOD-SYNC-WORKER] Starting PAT/Rejection sync for RTOM: ${rtom} (Job ID: ${job.id})`);
                const result = await ServiceOrderService.syncPatResults(opmcId, rtom, hoRejected || []);
                console.log(`[SOD-SYNC-WORKER] Completed PAT sync for RTOM: ${rtom}. Updated: ${result.updated}`);
                return result;
            } else {
                console.log(`[SOD-SYNC-WORKER] Starting Pending SOD sync for RTOM: ${rtom} (Job ID: ${job.id})`);
                const result = await ServiceOrderService.syncServiceOrders(opmcId, rtom);
                console.log(`[SOD-SYNC-WORKER] Completed SOD sync for RTOM: ${rtom}. Created: ${result.created}, Updated: ${result.updated}`);
                return result;
            }
        } catch (err) {
            console.error(`[SOD-SYNC-WORKER] Failed job ${type || 'PENDING'} for RTOM: ${rtom}`, err);
            throw err;
        }
    },
    {
        connection: redis as any,
        concurrency: 2 // Run 2 sync jobs simultaneously as requested
    }
);

console.log('✅ SOD Sync Worker initialized (Concurrency: 2)');
