export interface JobInfo {
    id: string;
    name?: string;
    state: string;
    progress: number;
    failedReason?: string;
    returnvalue?: unknown;
    data?: unknown;
    processedOn?: number;
    finishedOn?: number;
}

export interface QueueMetrics {
    active: number;
    waiting: number;
    completed: number;
    failed: number;
    delayed: number;
}

export interface QueueProvider {
    addJob(queueName: string, jobName: string, data: unknown, opts?: Record<string, unknown>): Promise<{ id: string }>;
    getJob(queueName: string, jobId: string): Promise<JobInfo | null>;
    getQueueMetrics(queueName: string): Promise<QueueMetrics>;
    getFailedJobs(queueName: string, start?: number, limit?: number): Promise<JobInfo[]>;
    getCompletedJobs(queueName: string, start?: number, limit?: number): Promise<Record<string, unknown>[]>;
    getRepeatableJobs(queueName: string): Promise<Record<string, unknown>[]>;
    /** Clears every registered repeatable in a queue; returns how many were removed. */
    removeRepeatableJobs(queueName: string): Promise<number>;
}
