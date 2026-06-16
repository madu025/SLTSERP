import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ bankId: string }> }
) {
    try {
        const { bankId } = await params;
        const branches = await prisma.bankBranch.findMany({
            where: { bankId },
            orderBy: { name: 'asc' }
        });
        return NextResponse.json(branches);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
