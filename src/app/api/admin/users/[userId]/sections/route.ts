import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - Fetch user's section assignments
export async function GET(
    request: NextRequest,
    { params }: { params: { userId: string } }
) {
    try {
        const assignments = await prisma.userSectionAssignment.findMany({
            where: { userId: params.userId },
            include: {
                section: true,
                role: true
            },
            orderBy: [
                { isPrimary: 'desc' },
                { createdAt: 'asc' }
            ]
        });

        return NextResponse.json(assignments);
    } catch (error) {
        console.error('Error fetching assignments:', error);
        return NextResponse.json({ error: 'Failed to fetch assignments' }, { status: 500 });
    }
}

// POST - Assign section/role to user
export async function POST(
    request: NextRequest,
    { params }: { params: { userId: string } }
) {
    try {
        const body = await request.json();
        const { sectionId, roleId, isPrimary } = body;

        if (!sectionId || !roleId) {
            return NextResponse.json({ error: 'Section and role are required' }, { status: 400 });
        }

        // If setting as primary, unset other primary assignments
        if (isPrimary) {
            await prisma.userSectionAssignment.updateMany({
                where: { userId: params.userId, isPrimary: true },
                data: { isPrimary: false }
            });
        }

        const assignment = await prisma.userSectionAssignment.create({
            data: {
                userId: params.userId,
                sectionId,
                roleId,
                isPrimary: isPrimary || false
            },
            include: {
                section: true,
                role: true
            }
        });

        return NextResponse.json(assignment, { status: 201 });
    } catch (error: any) {
        console.error('Error creating assignment:', error);
        if (error.code === 'P2002') {
            return NextResponse.json({ error: 'User already assigned to this section' }, { status: 400 });
        }
        return NextResponse.json({ error: 'Failed to create assignment' }, { status: 500 });
    }
}
