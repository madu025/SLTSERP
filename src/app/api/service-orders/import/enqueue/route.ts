import { apiHandler } from '@/lib/api-handler';
import { sodImportQueue, addJob } from '@/lib/queue';
import { AppError } from '@/lib/error';

export const dynamic = 'force-dynamic';

export const POST = apiHandler(async (request, _params, body) => {
    const userId = request.headers.get('x-user-id') || 'SYSTEM';
    const { rows, skipMaterials = false } = body || {};

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
        throw AppError.badRequest('No data to import');
    }

    const job = await addJob(sodImportQueue, 'sod-import-task', {
        rows,
        skipMaterials,
        userId
    });

    return {
        success: true,
        jobId: job.id,
        message: 'Import task queued successfully'
    };
}, {
    roles: ['ADMIN', 'SUPER_ADMIN'],
    audit: { action: 'ENQUEUE_BULK_IMPORT', entity: 'ServiceOrder' },
    rawResponse: true
});

export const GET = apiHandler(async (request) => {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');

    if (!jobId) {
        throw AppError.badRequest('Job ID required');
    }

    const job = await sodImportQueue.getJob(jobId);
    if (!job) {
        throw AppError.notFound('Job not found');
    }

    const state = await job.getState();
    const progress = job.progress;
    const result = job.returnvalue;
    const failedReason = job.failedReason;

    return {
        id: job.id,
        state,
        progress,
        result,
        failedReason
    };
}, { rawResponse: true });
