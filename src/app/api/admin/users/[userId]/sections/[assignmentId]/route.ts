import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// DELETE - Remove section assignment
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ userId: string; assignmentId: string }> }
) {
    try {
        const { assignmentId } = await params;
        await prisma.userSectionAssignment.delete({
            where: { id: assignmentId }
        });

        return NextResponse.json({ message: 'Assignment removed successfully' });
    } catch (error) {
        console.error('Error removing assignment:', error);
        return NextResponse.json({ error: 'Failed to remove assignment' }, { status: 500 });
    }
}
