import { NextRequest, NextResponse } from 'next/server';
import { ProjectTaskService } from '@/services/project-task.service';

// GET /api/projects/tasks/progress?taskId=xxx
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const taskId = searchParams.get('taskId');

        if (!taskId) {
            return NextResponse.json({ error: 'taskId is required' }, { status: 400 });
        }

        const logs = await ProjectTaskService.getProgressLogs(taskId);
        return NextResponse.json(logs);
    } catch (error: unknown) {
        console.error('Error fetching progress logs:', error);
        return NextResponse.json({ error: 'Failed to fetch progress logs' }, { status: 500 });
    }
}

// POST /api/projects/tasks/progress
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { taskId, progress } = body;

        if (!taskId || progress === undefined) {
            return NextResponse.json({ error: 'taskId and progress are required' }, { status: 400 });
        }

        const log = await ProjectTaskService.logProgress(body);
        return NextResponse.json(log, { status: 201 });
    } catch (error: unknown) {
        console.error('Error logging progress:', error);
        const errorMsg = error instanceof Error ? error.message : '';
        if (errorMsg === 'INVALID_PROGRESS_RANGE') {
            return NextResponse.json({ error: 'Progress must be a number between 0 and 100' }, { status: 400 });
        }
        return NextResponse.json({ error: 'Failed to log progress' }, { status: 500 });
    }
}
