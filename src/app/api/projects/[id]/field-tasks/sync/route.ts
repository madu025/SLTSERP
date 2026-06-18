import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST: Sync field task data from mobile device
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: projectId } = await params;
        const body = await request.json();
        const { tasks, deviceId, appVersion } = body;

        if (!tasks || !Array.isArray(tasks)) {
            return NextResponse.json({ error: 'Tasks array is required' }, { status: 400 });
        }

        const results = [];
        for (const task of tasks) {
            if (task.id) {
                const updated = await prisma.fieldTask.update({
                    where: { id: task.id },
                    data: {
                        status: task.status ?? undefined,
                        completedAt: task.completedAt ? new Date(task.completedAt) : undefined,
                        latitude: task.latitude ?? undefined,
                        longitude: task.longitude ?? undefined,
                        syncStatus: 'SYNCED',
                        deviceId: deviceId || undefined,
                        appVersion: appVersion || undefined
                    }
                });
                results.push(updated);
            } else {
                const created = await prisma.fieldTask.create({
                    data: {
                        projectId,
                        title: task.title,
                        description: task.description || null,
                        status: task.status || 'PENDING',
                        priority: task.priority || 'MEDIUM',
                        latitude: task.latitude || null,
                        longitude: task.longitude || null,
                        syncStatus: 'SYNCED',
                        deviceId: deviceId || null,
                        appVersion: appVersion || null
                    }
                });
                results.push(created);
            }
        }

        return NextResponse.json({
            synced: results.length,
            tasks: results
        });
    } catch (error) {
        console.error('Error syncing field tasks:', error);
        return NextResponse.json({ error: 'Failed to sync field tasks' }, { status: 500 });
    }
}

// GET: Check sync status for pending tasks
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: projectId } = await params;

        const pendingSync = await prisma.fieldTask.count({
            where: {
                projectId,
                syncStatus: { not: 'SYNCED' }
            }
        });

        const totalTasks = await prisma.fieldTask.count({
            where: { projectId }
        });

        return NextResponse.json({
            projectId,
            totalTasks,
            pendingSync,
            syncComplete: pendingSync === 0
        });
    } catch (error) {
        console.error('Error checking sync status:', error);
        return NextResponse.json({ error: 'Failed to check sync status' }, { status: 500 });
    }
}