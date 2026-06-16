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
