 
process.env.IS_WORKER = 'true';
import { Worker, Job } from 'bullmq';
import { createQueueConnection } from '../lib/redis-queue';
import { QUEUE_NAMES, statsUpdateQueue, addJob } from '../lib/queue';
import { ServiceOrderService } from '../services/service-order/sod.service';

export const sodSyncWorker = new Worker(
    QUEUE_NAMES.SOD_SYNC,
    async (job: Job) => {
        const { opmcId, rtom, type, windowMs, slotMs } = job.data as {
            opmcId: string;
            rtom: string;
            type?: 'PENDING' | 'PAT_REJECTION' | 'RTOM_SWEEP' | 'PERIODIC_GLOBAL_SYNC' | 'PERIODIC_PENDING_SYNC' | 'PERIODIC_COMPLETED_SYNC' | 'PERIODIC_RETURN_SYNC';
            windowMs?: number;
            slotMs?: number;
        };

        try {
            if (type === 'PAT_REJECTION') {
                console.log(`[SOD-SYNC-WORKER] Starting PAT/Rejection sync for RTOM: ${rtom} (Job ID: ${job.id})`);
                const result = await ServiceOrderService.syncPatResults(opmcId, rtom);
                await ServiceOrderService.updateGlobalSyncStats({ updated: result.updated });
                await addJob(statsUpdateQueue, `stats-${opmcId}`, { opmcId, type: 'SINGLE_OPMC' });
                console.log(`[SOD-SYNC-WORKER] Completed PAT sync for RTOM: ${rtom}. Updated: ${result.updated}`);
                return result;
            } else if (type === 'PERIODIC_GLOBAL_SYNC') {
                console.log(`[SOD-SYNC-WORKER] Starting Periodic Global PAT Sync (Job ID: ${job.id})`);
                const approvedResult = await ServiceOrderService.syncHoApprovedResults();
                const rejectedResult = await ServiceOrderService.syncHoRejectedResults();
                console.log(`[SOD-SYNC-WORKER] Completed Periodic Global PAT Sync.`);
                return { approvedResult, rejectedResult };
            } else if (type === 'PERIODIC_PENDING_SYNC') {
                // Scheduler tick: the only thing the external 10-minute cron drives. It seeds this
                // window's per-RTOM sweep, the bucket-aligned 20/30-minute cadences, the wall-clock
                // dailies and re-asserts the terminal-status self-heal. Nothing runs inline.
                console.log(`[SOD-SYNC-WORKER] Scheduler tick (Job ID: ${job.id})`);
                return await ServiceOrderService.runPendingSyncTick();
            } else if (type === 'RTOM_SWEEP') {
                console.log(`[SOD-SYNC-WORKER] RTOM sweep start for ${rtom} (Job ID: ${job.id})`);
                const result = await ServiceOrderService.syncServiceOrders(opmcId, rtom);
                await ServiceOrderService.updateGlobalSyncStats({ created: result.created, updated: result.updated });
                await addJob(statsUpdateQueue, `stats-${opmcId}`, { opmcId, type: 'SINGLE_OPMC' });
                // Continuation hop: queue this RTOM's next window before returning, so a failing
                // sync still keeps the chain (Bull retries the current window separately).
                try {
                    await ServiceOrderService.rescheduleRtomSweep(opmcId, rtom, windowMs, slotMs);
                } catch (rescheduleErr) {
                    console.error(`[SOD-SYNC-WORKER] RTOM sweep re-seed failed for ${rtom}:`, rescheduleErr);
                }
                console.log(`[SOD-SYNC-WORKER] RTOM sweep done for ${rtom}. Created: ${result.created}, Updated: ${result.updated}`);
                return result;
            } else if (type === 'PERIODIC_RETURN_SYNC') {
                // Return-reason enrichment: rotates a small RTOM slice per run (its own budgeting),
                // so it lives on its own 30-minute repeatable rather than riding the pending tick.
                console.log(`[SOD-SYNC-WORKER] Starting return-reason enrichment (Job ID: ${job.id})`);
                const result = await ServiceOrderService.syncReturnReasons();
                console.log(`[SOD-SYNC-WORKER] Return-reason enrichment: ${JSON.stringify(result)}`);
                return result;
            } else if (type === 'PERIODIC_COMPLETED_SYNC') {
                console.log(`[SOD-SYNC-WORKER] Starting Periodic Completed SOD Sync (Job ID: ${job.id})`);
                const { CompletedSODSyncService } = await import('../services/service-order/completed-sod-sync.service');
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
        connection: createQueueConnection('worker:sod-sync'),
        // One portal request per RTOM is a hard limit of the iShamp feed (it rejects every batch
        // form: con=SLTS, z=SLTS, comma/space lists all answer {"data":[]}), so throughput comes
        // from firing several RTOMs at once. A sweep waits 2-16s (avg ~7s) entirely on portal I/O,
        // which matches the seeded 1.5s stagger: ~5 jobs in flight, all 43 RTOMs inside ~70s.
        concurrency: 6
    }
);

console.log('✅ SOD Sync Worker initialized (Concurrency: 6)');
