import { apiHandler } from '@/lib/api-handler';
import { JobService } from '@/services/job.service';

export const dynamic = 'force-dynamic';

// GET all jobs
export const GET = apiHandler(async (request) => {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    const region = searchParams.get('region') || undefined;
    const assigneeId = searchParams.get('assigneeId') || undefined;

    const jobs = await JobService.getJobs({ status, region, assigneeId });
    return jobs;
}, { rawResponse: true });

// POST create new job
export const POST = apiHandler(async (_request, _params, body) => {
    const job = await JobService.createJob(body);
    return job;
}, {
    audit: { action: 'JOB_CREATE', entity: 'Job' },
    rawResponse: true
});