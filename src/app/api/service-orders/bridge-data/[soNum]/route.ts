import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
    request: Request,
    { params }: { params: { soNum: string } }
) {
    try {
        const { soNum } = params;

        if (!soNum) {
            return NextResponse.json({ message: 'SO Number is required' }, { status: 400 });
        }

        const rawData = await prisma.extensionRawData.findFirst({
            where: { soNum },
            orderBy: { createdAt: 'desc' }
        });

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
