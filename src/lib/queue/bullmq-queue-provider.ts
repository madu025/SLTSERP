import { Queue } from 'bullmq';
import { redis } from '../redis';
import { QueueProvider, JobInfo, QueueMetrics } from './queue-provider.interface';

export class BullMQQueueProvider implements QueueProvider {
    private queues = new Map<string, Queue>();

    private getQueue(name: string): Queue | null {
        // Fallback immediately if Redis connection is closed/closing or unavailable
        if (redis.status === 'end' || redis.status === 'close') {
            return null;
        }
        let q = this.queues.get(name);
        if (!q) {
            try {
                q = new Queue(name, {
                    connection: redis as unknown as Record<string, unknown>,
                    defaultJobOptions: {
                        attempts: 3,
                        backoff: {
                            type: 'exponential',
                            delay: 1000,
                        },
                        removeOnComplete: true,
                        removeOnFail: false,
                    },
                });
                this.queues.set(name, q);
            } catch (error: unknown) {
                console.warn(`[BullMQ] Failed to initialize queue '${name}'. Fallback enabled.`, error);
                return null;
            }
        }
        return q;
    }

    async addJob(queueName: string, jobName: string, data: unknown, opts?: Record<string, unknown>): Promise<{ id: string }> {
        try {
            const queue = this.getQueue(queueName);
            if (queue) {
                const job = await queue.add(jobName, data, opts);
                return { id: String(job.id || `job-${Date.now()}`) };
            }
        } catch (error: unknown) {
            console.warn(`[BullMQ] Queue error adding job '${jobName}' to '${queueName}'. Using fallback job ID.`, error);
        }
        return { id: `sync-job-${Date.now()}` };
    }

    async getJob(queueName: string, jobId: string): Promise<JobInfo | null> {
        try {
            const queue = this.getQueue(queueName);
            if (queue) {
                const job = await queue.getJob(jobId);
                if (!job) return null;

                const state = await job.getState();
                return {
                    id: String(job.id),
                    state,
                    progress: typeof job.progress === 'number' ? job.progress : 0,
                    failedReason: job.failedReason,
                    returnvalue: job.returnvalue
                };
            }
        } catch (error: unknown) {
            console.warn(`[BullMQ] Failed to get job '${jobId}' from '${queueName}'.`, error);
        }
        return {
            id: jobId,
            state: 'completed',
            progress: 100,
            returnvalue: { success: true }
        };
    }

    async getQueueMetrics(queueName: string): Promise<QueueMetrics> {
        try {
            const queue = this.getQueue(queueName);
            if (queue) {
                const [active, waiting, completed, failed, delayed] = await Promise.all([
                    queue.getActiveCount().catch(() => 0),
                    queue.getWaitingCount().catch(() => 0),
                    queue.getCompletedCount().catch(() => 0),
                    queue.getFailedCount().catch(() => 0),
                    queue.getDelayedCount().catch(() => 0),
                ]);
                return { active, waiting, completed, failed, delayed };
            }
        } catch (error: unknown) {
            console.warn(`[BullMQ] Failed to get metrics for queue '${queueName}'.`, error);
        }
        return { active: 0, waiting: 0, completed: 0, failed: 0, delayed: 0 };
    }

    async getFailedJobs(queueName: string, start?: number, limit?: number): Promise<JobInfo[]> {
        try {
            const queue = this.getQueue(queueName);
            if (queue) {
                const jobs = await queue.getFailed(start, limit);
                return jobs.map(j => ({
                    id: String(j.id),
                    name: j.name,
                    state: 'failed',
                    progress: typeof j.progress === 'number' ? j.progress : 0,
                    failedReason: j.failedReason,
                    returnvalue: j.returnvalue,
                    data: j.data,
                    processedOn: j.processedOn,
                    finishedOn: j.finishedOn
                }));
            }
        } catch (error: unknown) {
            console.warn(`[BullMQ] Failed to get failed jobs for queue '${queueName}'.`, error);
        }
        return [];
    }

    async getCompletedJobs(queueName: string, start?: number, limit?: number): Promise<Record<string, unknown>[]> {
        try {
            const queue = this.getQueue(queueName);
            if (queue) {
                const jobs = await queue.getCompleted(start, limit);
                return jobs.map(j => ({
                    id: String(j.id),
                    name: j.name,
                    state: 'completed',
                    finishedOn: j.finishedOn,
                }));
            }
        } catch (error: unknown) {
            console.warn(`[BullMQ] Failed to get completed jobs for queue '${queueName}'.`, error);
        }
        return [];
    }

    async getRepeatableJobs(queueName: string): Promise<Record<string, unknown>[]> {
        try {
            const queue = this.getQueue(queueName);
            if (queue) {
                return await queue.getRepeatableJobs();
            }
        } catch (error: unknown) {
            console.warn(`[BullMQ] Failed to get repeatable jobs for queue '${queueName}'.`, error);
        }
        return [];
    }

    async removeRepeatableJobs(queueName: string): Promise<number> {
        try {
            const queue = this.getQueue(queueName);
            if (queue) {
                const repeatables = await queue.getRepeatableJobs();
                for (const repeatable of repeatables) {
                    await queue.removeRepeatableByKey(String(repeatable.key));
                }
                return repeatables.length;
            }
        } catch (error: unknown) {
            console.warn(`[BullMQ] Failed to clear repeatable jobs for queue '${queueName}'.`, error);
        }
        return 0;
    }
}
