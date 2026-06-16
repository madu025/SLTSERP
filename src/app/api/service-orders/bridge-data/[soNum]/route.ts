import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ soNum: string }> }
) {
    try {
        const { soNum } = await params;

        if (!soNum) {
            return NextResponse.json({ message: 'SO Number is required' }, { status: 400 });
        }

        console.log(`[API-BRIDGE-DATA] Fetching for SO: ${soNum}`);

        const rawData = await prisma.extensionRawData.findFirst({
            where: { soNum: { equals: soNum, mode: 'insensitive' } },
            orderBy: { createdAt: 'desc' }
        });

        console.log(`[API-BRIDGE-DATA] Found: ${rawData ? 'YES' : 'NO'}`);

        return NextResponse.json({
            success: true,
            data: rawData
        });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({
            success: false,
            message: 'Failed to fetch bridge data',
            error: errorMessage
        }, { status: 500 });
    }
}
