import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/projects/[id]/field-tasks - List field tasks for a project
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const fieldTasks = await prisma.fieldTask.findMany({
            where: { projectId: id },
            orderBy: { createdAt: 'desc' },
            include: {
                photos: true,
                checklists: true,
                signatures: true,
            },
        });

        return NextResponse.json(fieldTasks);
    } catch (error) {
        console.error('Error fetching field tasks:', error);
        return NextResponse.json(
            { error: 'Failed to fetch field tasks' },
            { status: 500 }
        );
    }
}

// POST /api/projects/[id]/field-tasks - Create a new field task
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();

        const fieldTask = await prisma.fieldTask.create({
            data: {
                projectId: id,
                title: body.title,
                description: body.description || null,
                status: body.status || 'ASSIGNED',
                priority: body.priority || 'MEDIUM',
                scheduledDate: body.scheduledDate ? new Date(body.scheduledDate) : null,
                latitude: body.latitude || null,
                longitude: body.longitude || null,
                address: body.address || null,
                assignedUserId: body.assignedUserId || null,
            },
            include: {
                photos: true,
                checklists: true,
                signatures: true,
            },
        });

        return NextResponse.json(fieldTask, { status: 201 });
    } catch (error) {
        console.error('Error creating field task:', error);
        return NextResponse.json(
            { error: 'Failed to create field task' },
            { status: 500 }
        );
    }
}
