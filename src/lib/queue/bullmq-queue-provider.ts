import { Queue } from 'bullmq';
import { redis } from '../redis';
import { QueueProvider, JobInfo, QueueMetrics } from './queue-provider.interface';

export class BullMQQueueProvider implements QueueProvider {
    private queues = new Map<string, Queue>();

    private getQueue(name: string): Queue {
        let q = this.queues.get(name);
        if (!q) {
            q = new Queue(name, {
                connection: redis as any,
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
        }
        return q;
    }

    async addJob(queueName: string, jobName: string, data: unknown, opts?: any): Promise<{ id: string }> {
        const queue = this.getQueue(queueName);
        const job = await queue.add(jobName, data, opts);
        return { id: String(job.id) };
    }

    async getJob(queueName: string, jobId: string): Promise<JobInfo | null> {
        const queue = this.getQueue(queueName);
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

    async getQueueMetrics(queueName: string): Promise<QueueMetrics> {
        const queue = this.getQueue(queueName);
        const [active, waiting, completed, failed, delayed] = await Promise.all([
            queue.getActiveCount(),
            queue.getWaitingCount(),
            queue.getCompletedCount(),
            queue.getFailedCount(),
            queue.getDelayedCount(),
        ]);
        return { active, waiting, completed, failed, delayed };
    }

    async getFailedJobs(queueName: string, start: number, limit: number): Promise<any[]> {
        const queue = this.getQueue(queueName);
        const failedJobs = await queue.getFailed(start, start + limit);
        return failedJobs.map(job => ({
            id: job.id,
            name: job.name,
            data: job.data,
            failedReason: job.failedReason,
            processedOn: job.processedOn,
            finishedOn: job.finishedOn,
        }));
    }

    async getRepeatableJobs(queueName: string): Promise<any[]> {
        const queue = this.getQueue(queueName);
        return await queue.getRepeatableJobs();
    }
}
