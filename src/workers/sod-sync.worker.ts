/* eslint-disable @typescript-eslint/no-explicit-any */
process.env.IS_WORKER = 'true';
import { Worker, Job } from 'bullmq';
import { redis } from '../lib/redis';
import { QUEUE_NAMES, statsUpdateQueue, addJob } from '../lib/queue';
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
                const result = await ServiceOrderService.syncPatResults(opmcId, rtom);
                await ServiceOrderService.updateGlobalSyncStats({ updated: result.updated });
                await addJob(statsUpdateQueue, `stats-${opmcId}`, { opmcId, type: 'SINGLE_OPMC' });
                console.log(`[SOD-SYNC-WORKER] Completed PAT sync for RTOM: ${rtom}. Updated: ${result.updated}`);
                return result;
            } else if (type as any === 'PERIODIC_GLOBAL_SYNC') {
                console.log(`[SOD-SYNC-WORKER] Starting Periodic Global PAT Sync (Job ID: ${job.id})`);
                const result = await ServiceOrderService.syncHoApprovedResults();
                console.log(`[SOD-SYNC-WORKER] Completed Periodic Global PAT Sync.`);
                return result;
            } else if (type as any === 'PERIODIC_PENDING_SYNC') {
                console.log(`[SOD-SYNC-WORKER] Starting Periodic Pending SOD Sync (Job ID: ${job.id})`);
                const result = await ServiceOrderService.syncAllOpmcs();
                console.log(`[SOD-SYNC-WORKER] Completed Periodic Pending SOD Sync.`);
                return result;
            } else if (type as any === 'PERIODIC_COMPLETED_SYNC') {
                console.log(`[SOD-SYNC-WORKER] Starting Periodic Completed SOD Sync (Job ID: ${job.id})`);
                const { CompletedSODSyncService } = await import('../services/completed-sod-sync.service');
                const result = await CompletedSODSyncService.syncCompletedSODs();
                console.log(`[SOD-SYNC-WORKER] Completed Periodic Completed SOD Sync.`);
                return result;
            } else {
                console.log(`[SOD-SYNC-WORKER] Starting Pending SOD sync for RTOM: ${rtom} (Job ID: ${job.id})`);
                const result = await ServiceOrderService.syncServiceOrders(opmcId, rtom);
                await ServiceOrderService.updateGlobalSyncStats({ created: result.created, updated: result.updated });
                await addJob(statsUpdateQueue, `stats-${opmcId}`, { opmcId, type: 'SINGLE_OPMC' });
                console.log(`[SOD-SYNC-WORKER] Completed SOD sync for RTOM: ${rtom}. Created: ${result.created}, Updated: ${result.updated}`);
                return result;
            }
        } catch (err) {
            await ServiceOrderService.updateGlobalSyncStats({ failed: 1 });
            console.error(`[SOD-SYNC-WORKER] ❌ FATAL ERROR for RTOM ${rtom} (Job: ${job.id}):`, err);
            throw err;
        }
    },
    {
        connection: redis as any,
        concurrency: 2 // Run 2 sync jobs simultaneously as requested
    }
);

console.log('✅ SOD Sync Worker initialized (Concurrency: 2)');
