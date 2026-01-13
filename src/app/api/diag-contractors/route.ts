import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
    try {
        const contractors = await prisma.contractor.findMany({
            select: {
                id: true,
                name: true,
                status: true
            }
        });
        return NextResponse.json(contractors);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
