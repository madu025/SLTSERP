import { QueueProvider } from './queue/queue-provider.interface';
import { BullMQQueueProvider } from './queue/bullmq-queue-provider';

// Define names for our queues
export const QUEUE_NAMES = {
    SOD_IMPORT: 'sod-import-queue',
    NOTIFICATIONS: 'notifications-queue',
    STATS_UPDATE: 'stats-update-queue',
    SOD_SYNC: 'sod-sync-queue',
    SYSTEM: 'system-queue',
} as const;

let queueProvider: QueueProvider = new BullMQQueueProvider();

export function setQueueProvider(provider: QueueProvider) {
    queueProvider = provider;
}

export function getQueueProvider(): QueueProvider {
    return queueProvider;
}

// Compatibility wrapper factory
const createQueueWrapper = (name: string) => {
    return {
        name,
        add: async (jobName: string, data: unknown, opts?: any) => {
            return await queueProvider.addJob(name, jobName, data, opts);
        },
        getJob: async (jobId: string) => {
            const job = await queueProvider.getJob(name, jobId);
            if (!job) return null;
            return {
                id: job.id,
                getState: async () => job.state,
                progress: job.progress,
                returnvalue: job.returnvalue,
                failedReason: job.failedReason
            };
        },
        getActiveCount: async () => (await queueProvider.getQueueMetrics(name)).active,
        getWaitingCount: async () => (await queueProvider.getQueueMetrics(name)).waiting,
        getCompletedCount: async () => (await queueProvider.getQueueMetrics(name)).completed,
        getFailedCount: async () => (await queueProvider.getQueueMetrics(name)).failed,
        getDelayedCount: async () => (await queueProvider.getQueueMetrics(name)).delayed,
        getFailed: async (start: number, limit: number) => {
            return await queueProvider.getFailedJobs(name, start, limit);
        },
        getRepeatableJobs: async () => {
            return await queueProvider.getRepeatableJobs(name);
        }
    };
};

export const sodImportQueue = createQueueWrapper(QUEUE_NAMES.SOD_IMPORT);
export const notificationsQueue = createQueueWrapper(QUEUE_NAMES.NOTIFICATIONS);
export const statsUpdateQueue = createQueueWrapper(QUEUE_NAMES.STATS_UPDATE);
export const sodSyncQueue = createQueueWrapper(QUEUE_NAMES.SOD_SYNC);
export const systemQueue = createQueueWrapper(QUEUE_NAMES.SYSTEM);

export async function addJob(queue: any, name: string, data: unknown, opts?: any) {
    const queueName = typeof queue === 'string' ? queue : (queue?.name || String(queue));
    return await queueProvider.addJob(queueName, name, data, opts);
}
