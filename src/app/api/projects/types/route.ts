import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
    try {
        const projectTypes = await prisma.projectType.findMany({
            include: {
                _count: {
                    select: { projects: true, workflowTemplates: true }
                }
            },
            orderBy: { name: 'asc' }
        });

        return NextResponse.json(projectTypes);
    } catch (error) {
        console.error('Error fetching project types:', error);
        return NextResponse.json(
            { error: 'Failed to fetch project types' },
            { status: 500 }
        );
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { name, description } = body;

        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            return NextResponse.json(
                { error: 'Project type name is required' },
                { status: 400 }
            );
        }

        // Check for duplicate
        const existing = await prisma.projectType.findUnique({
            where: { name: name.trim() }
        });

        if (existing) {
            return NextResponse.json(
                { error: 'A project type with this name already exists' },
                { status: 409 }
            );
        }

        const projectType = await prisma.projectType.create({
            data: {
                name: name.trim(),
                description: description?.trim() || ''
            }
        });

        return NextResponse.json(projectType, { status: 201 });
    } catch (error) {
        console.error('Error creating project type:', error);
        return NextResponse.json(
            { error: 'Failed to create project type' },
            { status: 500 }
        );
    }
}
