import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
    try {
        const entries = await prisma.journalEntry.findMany({
            include: { lines: true },
            orderBy: { date: 'desc' }
        });
        return NextResponse.json({
            success: true,
            data: entries
        });
    } catch (err: any) {
        return NextResponse.json({
            success: false,
            error: err.message || String(err)
        }, { status: 500 });
    }
}
