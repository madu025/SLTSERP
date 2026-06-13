import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/projects/tasks/dependencies?taskId=xxx
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const taskId = searchParams.get('taskId');

        const where: any = {};
        if (taskId) where.taskId = taskId;

        const dependencies = await prisma.taskDependency.findMany({
            where,
            include: {
                task: { select: { id: true, name: true, wbsCode: true, status: true } },
                dependsOn: { select: { id: true, name: true, wbsCode: true, status: true } }
            }
        });

        return NextResponse.json(dependencies);
    } catch (error) {
        console.error('Error fetching dependencies:', error);
        return NextResponse.json({ error: 'Failed to fetch dependencies' }, { status: 500 });
    }
}

// POST /api/projects/tasks/dependencies
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { taskId, dependsOnTaskId, type, lagDays } = body;

        if (!taskId || !dependsOnTaskId) {
            return NextResponse.json({ error: 'taskId and dependsOnTaskId are required' }, { status: 400 });
        }

        if (taskId === dependsOnTaskId) {
            return NextResponse.json({ error: 'A task cannot depend on itself' }, { status: 400 });
        }

        // Check for circular dependency
        const existing = await prisma.taskDependency.findUnique({
            where: { taskId_dependsOnTaskId: { taskId, dependsOnTaskId } }
        });
        if (existing) {
            return NextResponse.json({ error: 'This dependency already exists' }, { status: 400 });
        }

        const dependency = await prisma.taskDependency.create({
            data: {
                taskId,
                dependsOnTaskId,
                type: type || 'FINISH_TO_START',
                lagDays: lagDays || 0
            },
            include: {
                task: { select: { id: true, name: true, wbsCode: true } },
                dependsOn: { select: { id: true, name: true, wbsCode: true } }
            }
        });

        return NextResponse.json(dependency, { status: 201 });
    } catch (error) {
        console.error('Error creating dependency:', error);
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

        await prisma.taskDependency.delete({ where: { id } });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting dependency:', error);
        return NextResponse.json({ error: 'Failed to delete dependency' }, { status: 500 });
    }
}
