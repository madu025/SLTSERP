import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/projects/tasks/progress?taskId=xxx
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const taskId = searchParams.get('taskId');

        if (!taskId) {
            return NextResponse.json({ error: 'taskId is required' }, { status: 400 });
        }

        const logs = await prisma.taskProgressLog.findMany({
            where: { taskId },
            orderBy: { date: 'desc' }
        });

        return NextResponse.json(logs);
    } catch (error) {
        console.error('Error fetching progress logs:', error);
        return NextResponse.json({ error: 'Failed to fetch progress logs' }, { status: 500 });
    }
}

async function updateParentProgress(parentId: string, tx: any) {
    const parent = await tx.projectTask.findUnique({
        where: { id: parentId },
        include: { children: { select: { actualProgress: true } } }
    });
    if (!parent) return;

    const children = parent.children;
    if (children.length > 0) {
        const avgProgress = children.reduce((sum: number, c: any) => sum + c.actualProgress, 0) / children.length;
        const newProgress = Math.round(avgProgress);
        
        await tx.projectTask.update({
            where: { id: parentId },
            data: { 
                actualProgress: newProgress,
                status: newProgress >= 100 ? 'COMPLETED' : newProgress > 0 ? 'IN_PROGRESS' : 'PENDING'
            }
        });
    }

    if (parent.parentId) {
        await updateParentProgress(parent.parentId, tx);
    }
}

// POST /api/projects/tasks/progress
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { taskId, progress, description, photoUrls, gpsLatitude, gpsLongitude, loggedById } = body;

        if (!taskId || progress === undefined) {
            return NextResponse.json({ error: 'taskId and progress are required' }, { status: 400 });
        }

        const progressVal = parseInt(progress, 10);
        if (isNaN(progressVal) || progressVal < 0 || progressVal > 100) {
            return NextResponse.json({ error: 'Progress must be a number between 0 and 100' }, { status: 400 });
        }

        const log = await prisma.$transaction(async (tx) => {
            // Create progress log
            const newLog = await tx.taskProgressLog.create({
                data: {
                    taskId,
                    progress: progressVal,
                    description: description || null,
                    photoUrls: photoUrls || [],
                    gpsLatitude: gpsLatitude ? parseFloat(gpsLatitude) : null,
                    gpsLongitude: gpsLongitude ? parseFloat(gpsLongitude) : null,
                    loggedById: loggedById || null
                }
            });

            // Update the task's actual progress
            await tx.projectTask.update({
                where: { id: taskId },
                data: {
                    actualProgress: progressVal,
                    status: progressVal >= 100 ? 'COMPLETED' : progressVal > 0 ? 'IN_PROGRESS' : 'PENDING',
                    actualStartDate: progressVal > 0 ? new Date() : undefined,
                    actualEndDate: progressVal >= 100 ? new Date() : undefined
                }
            });

            // Fetch task to check for parent WBS level
            const task = await tx.projectTask.findUnique({
                where: { id: taskId },
                select: { parentId: true }
            });

            // Recursively update parents
            if (task?.parentId) {
                await updateParentProgress(task.parentId, tx);
            }

            return newLog;
        });

        return NextResponse.json(log, { status: 201 });
    } catch (error) {
        console.error('Error logging progress:', error);
        return NextResponse.json({ error: 'Failed to log progress' }, { status: 500 });
    }
}
