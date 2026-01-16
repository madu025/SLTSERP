import { Queue, JobsOptions } from 'bullmq';
import { redis } from './redis';

// Define names for our queues
export const QUEUE_NAMES = {
    SOD_IMPORT: 'sod-import-queue',
    NOTIFICATIONS: 'notifications-queue',
    STATS_UPDATE: 'stats-update-queue',
} as const;

// Helper to create a queue
const createQueue = (name: string) => {
    return new Queue(name, {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
};

// Initialize queues
export const sodImportQueue = createQueue(QUEUE_NAMES.SOD_IMPORT);
export const notificationsQueue = createQueue(QUEUE_NAMES.NOTIFICATIONS);
export const statsUpdateQueue = createQueue(QUEUE_NAMES.STATS_UPDATE);

// Utility to add jobs to queues
export async function addJob(queue: Queue, name: string, data: unknown, opts?: JobsOptions) {
    return await queue.add(name, data, opts);
}
