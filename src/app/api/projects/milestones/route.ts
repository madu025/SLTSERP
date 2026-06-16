import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST create milestone
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { projectId, name, description, targetDate, status } = body;

        if (!projectId || !name || !targetDate) {
            return NextResponse.json(
                { error: 'Project ID, Name and Target Date are required' },
                { status: 400 }
            );
        }

        const milestone = await prisma.projectMilestone.create({
            data: {
                projectId,
                name,
                description: description || null,
                targetDate: new Date(targetDate),
                status: status || 'PENDING',
                progress: 0
            }
        });

        return NextResponse.json(milestone);
    } catch (error) {
        console.error('Error creating milestone:', error);
        return NextResponse.json(
            { error: 'Failed to create milestone' },
            { status: 500 }
        );
    }
}

// PATCH update milestone
export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        const { id, completedDate, targetDate, ...updateData } = body;

        if (!id) {
            return NextResponse.json(
                { error: 'Milestone ID required' },
                { status: 400 }
            );
        }

        // Handle dates
        if (targetDate) updateData.targetDate = new Date(targetDate);
        if (completedDate) updateData.completedDate = new Date(completedDate);

        // Auto update completedDate if status changes to COMPLETED
        if (updateData.status === 'COMPLETED' && !updateData.completedDate) {
            updateData.completedDate = new Date();
            updateData.progress = 100;
        }

        const milestone = await prisma.projectMilestone.update({
            where: { id },
            data: updateData
        });

        return NextResponse.json(milestone);
    } catch (error) {
        console.error('Error updating milestone:', error);
        return NextResponse.json(
            { error: 'Failed to update milestone' },
            { status: 500 }
        );
    }
}

// DELETE milestone
export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json(
                { error: 'Milestone ID required' },
                { status: 400 }
            );
        }

        await prisma.projectMilestone.delete({
            where: { id }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting milestone:', error);
        return NextResponse.json(
            { error: 'Failed to delete milestone' },
            { status: 500 }
        );
    }
}
