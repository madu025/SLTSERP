import { NextRequest, NextResponse } from 'next/server';
import { ProjectTaskService } from '@/services/project-task.service';

// GET /api/projects/tasks?projectId=xxx
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get('projectId');
        const parentId = searchParams.get('parentId');

        if (!projectId) {
            return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
        }

        const tasks = await ProjectTaskService.getTasks(projectId, parentId);
        return NextResponse.json(tasks);
    } catch (error: unknown) {
        console.error('Error fetching tasks:', error);
        return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
    }
}

// POST /api/projects/tasks
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { projectId, name, wbsCode } = body;

        if (!projectId || !name || !wbsCode) {
            return NextResponse.json({ error: 'projectId, name, and wbsCode are required' }, { status: 400 });
        }

        const task = await ProjectTaskService.createTask(body);
        return NextResponse.json(task, { status: 201 });
    } catch (error: unknown) {
        console.error('Error creating task:', error);
        return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
    }
}

// PATCH /api/projects/tasks
export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json();
        const { id, ...updateData } = body;

        if (!id) {
            return NextResponse.json({ error: 'Task ID is required' }, { status: 400 });
        }

        const task = await ProjectTaskService.updateTask(id, updateData);
        return NextResponse.json(task);
    } catch (error: unknown) {
        console.error('Error updating task:', error);
        return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
    }
}

// DELETE /api/projects/tasks?id=xxx
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Task ID is required' }, { status: 400 });
        }

        await ProjectTaskService.deleteTask(id);
        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        console.error('Error deleting task:', error);
        const errorMsg = error instanceof Error ? error.message : '';
        if (errorMsg === 'HAS_SUB_TASKS') {
            return NextResponse.json({ error: 'Cannot delete task with sub-tasks. Remove sub-tasks first.' }, { status: 400 });
        }
        return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 });
    }
}
