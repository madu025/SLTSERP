import { addJob } from './queue';

/**
 * Cron enqueue helper.
 *
 * `addJob` never throws: when Redis refuses the write the BullMQ provider logs a warning and
 * hands back a synthetic id, so a caller that only checks for an exception reports success while
 * nothing was queued and no worker will ever run. Cron handlers are the only thing standing between
 * a scheduler ping and actual sync work, so they must surface that difference instead of hiding it.
 */

/** Synthetic id prefix returned by BullMQQueueProvider.addJob when the queue write was lost. */
const FALLBACK_ID_PREFIX = 'sync-job-';

export interface CronEnqueueResult {
    id: string;
    accepted: boolean;
}

type QueueLike = { name: string };

export async function enqueueCronJob(queue: QueueLike, jobName: string, data: unknown, opts?: Record<string, unknown>): Promise<CronEnqueueResult> {
    const job = await addJob(queue, jobName, data, opts);
    const id = String(job.id ?? '');
    const accepted = id.length > 0 && !id.startsWith(FALLBACK_ID_PREFIX);
    if (!accepted) {
        console.error(`[CRON] '${jobName}' was NOT accepted by queue '${queue.name}' (Redis unavailable?). No background job will run.`);
    }
    return { id, accepted };
}
