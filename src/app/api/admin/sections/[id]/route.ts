import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// PATCH - Update section
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { name, code, description, icon, color, isActive } = body;

        const section = await prisma.section.update({
            where: { id: id },
            data: {
                ...(name && { name }),
                ...(code && { code: code.toUpperCase() }),
                ...(description !== undefined && { description }),
                ...(icon !== undefined && { icon }),
                ...(color !== undefined && { color }),
                ...(isActive !== undefined && { isActive })
            }
        });

        return NextResponse.json(section);
    } catch (error) {
        console.error('Error updating section:', error);
        return NextResponse.json({ error: 'Failed to update section' }, { status: 500 });
    }
}

// DELETE - Delete section
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        await prisma.section.delete({
            where: { id: id }
        });

        return NextResponse.json({ message: 'Section deleted successfully' });
    } catch (error) {
        console.error('Error deleting section:', error);
        return NextResponse.json({ error: 'Failed to delete section' }, { status: 500 });
    }
}
