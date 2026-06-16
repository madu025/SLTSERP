import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/projects/tasks?projectId=xxx
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get('projectId');
        const parentId = searchParams.get('parentId');

        if (!projectId) {
            return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
        }

        const where: any = { projectId };
        if (parentId === 'null') {
            where.parentId = null;
        } else if (parentId) {
            where.parentId = parentId;
        }

        const tasks = await prisma.projectTask.findMany({
            where,
            include: {
                children: { select: { id: true, name: true, status: true, actualProgress: true } },
                dependencies: {
                    include: { dependsOn: { select: { id: true, name: true, status: true, wbsCode: true } } }
                },
                progressLogs: { orderBy: { date: 'desc' }, take: 5 },
                _count: { select: { children: true, timesheets: true } }
            },
            orderBy: { order: 'asc' }
        });

        return NextResponse.json(tasks);
    } catch (error) {
        console.error('Error fetching tasks:', error);
        return NextResponse.json({ error: 'Failed to fetch tasks' }, { status: 500 });
    }
}

// POST /api/projects/tasks
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { projectId, parentId, wbsCode, name, description, type, plannedStartDate, plannedEndDate, plannedDuration, priority, estimatedCost, order, assigneeType, assigneeId } = body;

        if (!projectId || !name || !wbsCode) {
            return NextResponse.json({ error: 'projectId, name, and wbsCode are required' }, { status: 400 });
        }

        // Auto-generate WBS code if not provided for child tasks
        let finalWbsCode = wbsCode;
        if (parentId && !wbsCode) {
            const parent = await prisma.projectTask.findUnique({ where: { id: parentId } });
            if (parent) {
                const siblingCount = await prisma.projectTask.count({ where: { parentId } });
                finalWbsCode = `${parent.wbsCode}.${siblingCount + 1}`;
            }
        }

        const task = await prisma.projectTask.create({
            data: {
                projectId,
                parentId: parentId || null,
                wbsCode: finalWbsCode,
                name,
                description,
                type: type || 'TASK',
                priority: priority || 'MEDIUM',
                plannedStartDate: plannedStartDate ? new Date(plannedStartDate) : null,
                plannedEndDate: plannedEndDate ? new Date(plannedEndDate) : null,
                plannedDuration: plannedDuration ? parseInt(plannedDuration) : null,
                estimatedCost: estimatedCost ? parseFloat(estimatedCost) : null,
                order: order || 0,
                assigneeType,
                assigneeId,
                status: 'PENDING',
                actualProgress: 0
            },
            include: {
                children: { select: { id: true, name: true, status: true } },
                _count: { select: { children: true } }
            }
        });

        return NextResponse.json(task, { status: 201 });
    } catch (error) {
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

        // Convert date strings to Date objects
        const data: any = { ...updateData };
        if (data.plannedStartDate) data.plannedStartDate = new Date(data.plannedStartDate);
        if (data.plannedEndDate) data.plannedEndDate = new Date(data.plannedEndDate);
        if (data.actualStartDate) data.actualStartDate = new Date(data.actualStartDate);
        if (data.actualEndDate) data.actualEndDate = new Date(data.actualEndDate);

        if (data.estimatedCost) data.estimatedCost = parseFloat(data.estimatedCost);

        const task = await prisma.projectTask.update({
            where: { id },
            data,
            include: {
                children: { select: { id: true, name: true, status: true } },
                dependencies: {
                    include: { dependsOn: { select: { id: true, name: true, status: true } } }
                }
            }
        });

        return NextResponse.json(task);
    } catch (error) {
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

        // Check if task has children
        const childCount = await prisma.projectTask.count({ where: { parentId: id } });
        if (childCount > 0) {
            return NextResponse.json({ error: 'Cannot delete task with sub-tasks. Remove sub-tasks first.' }, { status: 400 });
        }

        await prisma.projectTask.delete({ where: { id } });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting task:', error);
        return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 });
    }
}
