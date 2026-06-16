import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
    try {
        const banks = await (prisma as any).bank.findMany({
            orderBy: { name: 'asc' }
        });
        return NextResponse.json(banks);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
