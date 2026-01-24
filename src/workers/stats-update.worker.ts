import { Worker, Job } from 'bullmq';
import { redis } from '@/lib/redis';
import { QUEUE_NAMES } from '@/lib/queue';
import { StatsService } from '@/lib/stats.service';

/**
 * Worker to handle background statistics updates.
 * This decouples intensive counting operations from the main sync/import processes.
 */
export const statsUpdateWorker = new Worker(
    QUEUE_NAMES.STATS_UPDATE,
    async (job: Job) => {
        const { opmcId, type } = job.data as {
            opmcId?: string;
            type: 'SINGLE_OPMC' | 'GLOBAL' | 'DRIFT_CORRECTION';
        };

        try {
            console.log(`[STATS-WORKER] Starting ${type} update for OPMC: ${opmcId || 'ALL'} (Job ID: ${job.id})`);

            if (type === 'GLOBAL') {
                await StatsService.globalRecalculate();
            } else if (type === 'DRIFT_CORRECTION') {
                await StatsService.driftCorrection();
            } else if (opmcId) {
                await StatsService.syncOpmcStats(opmcId);
            }

            console.log(`[STATS-WORKER] Completed ${type} update for OPMC: ${opmcId || 'ALL'}`);
            return { success: true };
        } catch (err) {
            console.error(`[STATS-WORKER] Failed ${type} update for OPMC: ${opmcId || 'ALL'}`, err);
            throw err;
        }
    },
    {
        connection: redis as any,
        concurrency: 2 // Allow 2 stat updates at a time
    }
);
