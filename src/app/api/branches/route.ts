import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
    try {
        const branches = await (prisma as any).bankBranch.findMany({
            orderBy: { name: 'asc' }
        });
        return NextResponse.json(branches);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
