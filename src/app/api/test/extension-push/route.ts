import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
    try {
        const body = await request.json();

        // Log the raw data to the database for testing
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const log = await (prisma as any).extensionRawData.create({
            data: {
                soNum: body.soNum || null,
                sltUser: body.currentUser || null,
                activeTab: body.activeTab || null,
                url: body.url || null,
                scrapedData: body, // Store the entire object
            }
        });

        console.log(`[EXTENSION-PUSH] Received data for SO: ${body.soNum} from user: ${body.currentUser}`);

        return NextResponse.json({
            success: true,
            message: 'Data logged successfully',
            id: log.id
        });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('[EXTENSION-PUSH] Error logging data:', error);
        return NextResponse.json(
            { success: false, error: errorMessage },
            { status: 500 }
        );
    }
}

export async function GET() {
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const logs = await (prisma as any).extensionRawData.findMany({
            orderBy: { createdAt: 'desc' },
            take: 100
        });

        return NextResponse.json({ success: true, logs });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json(
            { success: false, error: errorMessage },
            { status: 500 }
        );
    }
}
