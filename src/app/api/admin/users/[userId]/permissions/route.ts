import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - Fetch user's permissions
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
            }
        });

        return NextResponse.json(assignments);
    } catch (error) {
        console.error('Error fetching permissions:', error);
        return NextResponse.json({ error: 'Failed to fetch permissions' }, { status: 500 });
    }
}

// PATCH - Update user's permissions
export async function PATCH(
    request: NextRequest,
    { params }: { params: { userId: string } }
) {
    try {
        const body = await request.json();
        const { permissions } = body;

        if (!Array.isArray(permissions)) {
            return NextResponse.json({ error: 'Permissions must be an array' }, { status: 400 });
        }

        // Get user's section assignments
        const assignments = await prisma.userSectionAssignment.findMany({
            where: { userId: params.userId },
            include: { role: true }
        });

        // Update permissions for all roles
        const permissionsJson = JSON.stringify(permissions);

        await Promise.all(
            assignments.map(assignment =>
                prisma.systemRole.update({
                    where: { id: assignment.roleId },
                    data: { permissions: permissionsJson }
                })
            )
        );

        return NextResponse.json({ message: 'Permissions updated successfully' });
    } catch (error) {
        console.error('Error updating permissions:', error);
        return NextResponse.json({ error: 'Failed to update permissions' }, { status: 500 });
    }
}
