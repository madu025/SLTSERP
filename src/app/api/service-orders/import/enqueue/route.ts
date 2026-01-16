import { NextResponse } from 'next/server';
import { sodImportQueue, addJob } from '@/lib/queue';
import { handleApiError } from '@/lib/api-utils';

export async function POST(request: Request) {
    try {
        const userId = request.headers.get('x-user-id');
        const userRole = request.headers.get('x-user-role');

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!['ADMIN', 'SUPER_ADMIN'].includes(userRole || '')) {
            return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
        }

        const body = await request.json();
        const { rows, skipMaterials = false } = body;

        if (!rows || !Array.isArray(rows) || rows.length === 0) {
            return NextResponse.json({ error: 'No data to import' }, { status: 400 });
        }

        // Add job to the queue
        const job = await addJob(sodImportQueue, 'sod-import-task', {
            rows,
            skipMaterials,
            userId
        });

        return NextResponse.json({
            success: true,
            jobId: job.id,
            message: 'Import task queued successfully'
        });
    } catch (error) {
        return handleApiError(error);
    }
}

// GET status of a job
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const jobId = searchParams.get('jobId');

        if (!jobId) {
            return NextResponse.json({ error: 'Job ID required' }, { status: 400 });
        }

        const job = await sodImportQueue.getJob(jobId);
        if (!job) {
            return NextResponse.json({ error: 'Job not found' }, { status: 404 });
        }

        const state = await job.getState();
        const progress = job.progress;
        const result = job.returnvalue;
        const failedReason = job.failedReason;

        return NextResponse.json({
            id: job.id,
            state,
            progress,
            result,
            failedReason
        });
    } catch (error) {
        return handleApiError(error);
    }
}
