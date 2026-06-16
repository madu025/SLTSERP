export interface JobInfo {
    id: string;
    state: string;
    progress: number;
    failedReason?: string;
    returnvalue?: any;
}

export interface QueueMetrics {
    active: number;
    waiting: number;
    completed: number;
    failed: number;
    delayed: number;
}

export interface QueueProvider {
    addJob(queueName: string, jobName: string, data: unknown, opts?: any): Promise<{ id: string }>;
    getJob(queueName: string, jobId: string): Promise<JobInfo | null>;
    getQueueMetrics(queueName: string): Promise<QueueMetrics>;
    getFailedJobs(queueName: string, start: number, limit: number): Promise<any[]>;
    getRepeatableJobs(queueName: string): Promise<any[]>;
}
