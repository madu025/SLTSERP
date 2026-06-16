import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/projects/[id]/field-tasks/[taskId] - Get a single field task with relations
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; taskId: string }> }
) {
    try {
        const { id, taskId } = await params;

        const fieldTask = await prisma.fieldTask.findUnique({
            where: { id: taskId },
            include: {
                photos: true,
                checklists: true,
                signatures: true,
            },
        });

        if (!fieldTask || fieldTask.projectId !== id) {
            return NextResponse.json(
                { error: 'Field task not found' },
                { status: 404 }
            );
        }

        return NextResponse.json(fieldTask);
    } catch (error) {
        console.error('Error fetching field task:', error);
        return NextResponse.json(
            { error: 'Failed to fetch field task' },
            { status: 500 }
        );
    }
}

// PATCH /api/projects/[id]/field-tasks/[taskId] - Update a field task
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; taskId: string }> }
) {
    try {
        const { id, taskId } = await params;

        // Verify existence first
        const existing = await prisma.fieldTask.findUnique({
            where: { id: taskId },
        });

        if (!existing || existing.projectId !== id) {
            return NextResponse.json(
                { error: 'Field task not found' },
                { status: 404 }
            );
        }

        const body = await request.json();

        // Extract only the allowed updatable fields
        const {
            title,
            description,
            status,
            priority,
            scheduledDate,
            startedAt,
            completedAt,
            durationMinutes,
            latitude,
            longitude,
            address,
            syncStatus,
            deviceId,
            appVersion,
        } = body;

        // Build update data, converting date strings to Date objects
        const updateData: Record<string, unknown> = {};

        if (title !== undefined) updateData.title = title;
        if (description !== undefined) updateData.description = description;
        if (status !== undefined) updateData.status = status;
        if (priority !== undefined) updateData.priority = priority;
        if (scheduledDate !== undefined) updateData.scheduledDate = new Date(scheduledDate);
        if (startedAt !== undefined) updateData.startedAt = new Date(startedAt);
        if (completedAt !== undefined) updateData.completedAt = new Date(completedAt);
        if (durationMinutes !== undefined) updateData.durationMinutes = durationMinutes;
        if (latitude !== undefined) updateData.latitude = latitude;
        if (longitude !== undefined) updateData.longitude = longitude;
        if (address !== undefined) updateData.address = address;
        if (syncStatus !== undefined) updateData.syncStatus = syncStatus;
        if (deviceId !== undefined) updateData.deviceId = deviceId;
        if (appVersion !== undefined) updateData.appVersion = appVersion;

        const updatedFieldTask = await prisma.fieldTask.update({
            where: { id: taskId },
            data: updateData,
            include: {
                photos: true,
                checklists: true,
                signatures: true,
            },
        });

        return NextResponse.json(updatedFieldTask);
    } catch (error) {
        console.error('Error updating field task:', error);
        return NextResponse.json(
            { error: 'Failed to update field task' },
            { status: 500 }
        );
    }
}

// DELETE /api/projects/[id]/field-tasks/[taskId] - Delete a field task
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; taskId: string }> }
) {
    try {
        const { id, taskId } = await params;

        // Verify existence before deleting
        const existing = await prisma.fieldTask.findUnique({
            where: { id: taskId },
        });

        if (!existing || existing.projectId !== id) {
            return NextResponse.json(
                { error: 'Field task not found' },
                { status: 404 }
            );
        }

        await prisma.fieldTask.delete({
            where: { id: taskId },
        });

        return new NextResponse(null, { status: 204 });
    } catch (error) {
        console.error('Error deleting field task:', error);
        return NextResponse.json(
            { error: 'Failed to delete field task' },
            { status: 500 }
        );
    }
}
