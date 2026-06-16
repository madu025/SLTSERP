import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST: Create a new field photo for a field task
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string; taskId: string }> }
) {
    try {
        const { id: projectId, taskId } = await params;
        const { fileName, fileUrl, photoType, latitude, longitude } = await request.json();

        // Validate required fields
        if (!fileName || !fileUrl || !photoType) {
            return NextResponse.json(
                { error: 'fileName, fileUrl, and photoType are required' },
                { status: 400 }
            );
        }

        // Validate photoType
        const validPhotoTypes = ['PROOF', 'PROGRESS', 'COMPLETION', 'DEFECT', 'OTHER'];
        if (!validPhotoTypes.includes(photoType)) {
            return NextResponse.json(
                { error: 'Invalid photoType. Must be one of: ' + validPhotoTypes.join(', ') },
                { status: 400 }
            );
        }

        // Verify the project exists
        const project = await prisma.project.findUnique({
            where: { id: projectId }
        });

        if (!project) {
            return NextResponse.json(
                { error: 'Project not found' },
                { status: 404 }
            );
        }

        // Verify the field task exists and belongs to the project
        const fieldTask = await prisma.fieldTask.findUnique({
            where: { id: taskId }
        });

        if (!fieldTask) {
            return NextResponse.json(
                { error: 'Field task not found' },
                { status: 404 }
            );
        }

        if (fieldTask.projectId !== projectId) {
            return NextResponse.json(
                { error: 'Field task does not belong to the specified project' },
                { status: 400 }
            );
        }

        // Create the field photo record
        const photo = await prisma.fieldPhoto.create({
            data: {
                fieldTaskId: taskId,
                fileName,
                fileUrl,
                photoType,
                latitude: latitude ?? null,
                longitude: longitude ?? null,
            }
        });

        return NextResponse.json(photo, { status: 201 });
    } catch (error) {
        console.error('Error creating field photo:', error);
        return NextResponse.json(
            { error: 'Failed to create field photo' },
            { status: 500 }
        );
    }
}

