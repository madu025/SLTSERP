import { NextRequest, NextResponse } from 'next/server';
import { ProjectTaskService } from '@/services/project-task.service';

// GET /api/projects/tasks/dependencies?taskId=xxx
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const taskId = searchParams.get('taskId');

        const dependencies = await ProjectTaskService.getDependencies(taskId);
        return NextResponse.json(dependencies);
    } catch (error: unknown) {
        console.error('Error fetching dependencies:', error);
        return NextResponse.json({ error: 'Failed to fetch dependencies' }, { status: 500 });
    }
}

// POST /api/projects/tasks/dependencies
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { taskId, dependsOnTaskId } = body;

        if (!taskId || !dependsOnTaskId) {
            return NextResponse.json({ error: 'taskId and dependsOnTaskId are required' }, { status: 400 });
        }

        const dependency = await ProjectTaskService.createDependency(body);
        return NextResponse.json(dependency, { status: 201 });
    } catch (error: unknown) {
        console.error('Error creating dependency:', error);
        const errorMsg = error instanceof Error ? error.message : '';
        if (errorMsg === 'SELF_DEPENDENCY') {
            return NextResponse.json({ error: 'A task cannot depend on itself' }, { status: 400 });
        }
        if (errorMsg === 'DEPENDENCY_EXISTS') {
            return NextResponse.json({ error: 'This dependency already exists' }, { status: 400 });
        }
        return NextResponse.json({ error: 'Failed to create dependency' }, { status: 500 });
    }
}

// DELETE /api/projects/tasks/dependencies?id=xxx
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Dependency ID is required' }, { status: 400 });
        }

        await ProjectTaskService.deleteDependency(id);
        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        console.error('Error deleting dependency:', error);
        return NextResponse.json({ error: 'Failed to delete dependency' }, { status: 500 });
    }
}
