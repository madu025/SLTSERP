import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - Fetch user's permissions
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ userId: string }> }
) {
    try {
        const { userId } = await params;
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { permissions: true }
        });

        const assignments = await prisma.userSectionAssignment.findMany({
            where: { userId: userId },
            include: {
                section: true,
                role: true
            }
        });

        const mapped = assignments.map(a => {
            if (user?.permissions) {
                return {
                    ...a,
                    role: {
                        ...a.role,
                        permissions: user.permissions
                    }
                };
            }
            return a;
        });

        return NextResponse.json(mapped);
    } catch (error) {
        console.error('Error fetching permissions:', error);
        return NextResponse.json({ error: 'Failed to fetch permissions' }, { status: 500 });
    }
}

// PATCH - Update user's permissions
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ userId: string }> }
) {
    try {
        const { userId } = await params;
        const body = await request.json();
        const { permissions } = body;

        if (!Array.isArray(permissions)) {
            return NextResponse.json({ error: 'Permissions must be an array' }, { status: 400 });
        }

        // Update permissions directly on User model to prevent leak to other users sharing the same role
        await prisma.user.update({
            where: { id: userId },
            data: {
                permissions: JSON.stringify(permissions)
            }
        });

        return NextResponse.json({ message: 'Permissions updated successfully' });
    } catch (error) {
        console.error('Error updating permissions:', error);
        return NextResponse.json({ error: 'Failed to update permissions' }, { status: 500 });
    }
}
