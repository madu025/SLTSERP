import { apiHandler } from '@/lib/api-handler';
import { JobService } from '@/services/job.service';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (_request, params) => {
    const { id } = await params;
    return await JobService.getJobById(id);
}, { rawResponse: true });

export const PATCH = apiHandler(async (_request, params, body) => {
    const { id } = await params;
    return await JobService.updateJob(id, body);
}, {
    audit: { action: 'JOB_UPDATE', entity: 'Job' },
    rawResponse: true
});

export const DELETE = apiHandler(async (_request, params) => {
    const { id } = await params;
    await JobService.deleteJob(id);
    return { success: true };
}, {
    roles: ['ADMIN', 'SUPER_ADMIN'],
    audit: { action: 'JOB_DELETE', entity: 'Job' },
    rawResponse: true
});

export const POST = apiHandler(async (_request, params, body) => {
    const { id } = await params;
    const result = await JobService.assignJobToSurvey(id, body);
    return result;
}, {
    audit: { action: 'JOB_ASSIGN_SURVEY', entity: 'Job' },
    rawResponse: true
});
