import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// PATCH - Update role
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; roleId: string }> }
) {
    try {
        const { roleId } = await params;
        const body = await request.json();
        const { name, code, description, level, permissions, isActive } = body;

        const role = await prisma.systemRole.update({
            where: { id: roleId },
            data: {
                ...(name && { name }),
                ...(code && { code: code.toUpperCase() }),
                ...(description !== undefined && { description }),
                ...(level !== undefined && { level }),
                ...(permissions !== undefined && { permissions }),
                ...(isActive !== undefined && { isActive })
            }
        });

        return NextResponse.json(role);
    } catch (error) {
        console.error('Error updating role:', error);
        return NextResponse.json({ error: 'Failed to update role' }, { status: 500 });
    }
}

// DELETE - Delete role
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; roleId: string }> }
) {
    try {
        const { roleId } = await params;
        await prisma.systemRole.delete({
            where: { id: roleId }
        });

        return NextResponse.json({ message: 'Role deleted successfully' });
    } catch (error) {
        console.error('Error deleting role:', error);
        return NextResponse.json({ error: 'Failed to delete role' }, { status: 500 });
    }
}
