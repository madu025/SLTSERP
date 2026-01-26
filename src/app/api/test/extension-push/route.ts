import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function OPTIONS() {
    return new NextResponse(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, x-user-id, x-user-role',
        },
    });
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const soNum = body.soNum;

        // Ignore IMAGES tab as requested
        if (body.activeTab === 'IMAGES' || body.activeTab === 'PHOTOS') {
            return NextResponse.json({ success: true, message: 'Images tab ignored' }, {
                headers: { 'Access-Control-Allow-Origin': '*' }
            });
        }

        let log;
        if (soNum) {
            // Try to find existing row for this SO
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const existing = await (prisma as any).extensionRawData.findFirst({
                where: { soNum: soNum }
            });

            if (existing) {
                // Update existing row
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                log = await (prisma as any).extensionRawData.update({
                    where: { id: existing.id },
                    data: {
                        sltUser: body.currentUser || null,
                        activeTab: body.activeTab || null,
                        url: body.url || null,
                        scrapedData: body,
                    }
                });
            } else {
                // Create new row
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                log = await (prisma as any).extensionRawData.create({
                    data: {
                        soNum: soNum,
                        sltUser: body.currentUser || null,
                        activeTab: body.activeTab || null,
                        url: body.url || null,
                        scrapedData: body,
                    }
                });
            }
        } else {
            // No soNum, just create (should not happen often with updated addon)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            log = await (prisma as any).extensionRawData.create({
                data: {
                    soNum: null,
                    sltUser: body.currentUser || null,
                    activeTab: body.activeTab || null,
                    url: body.url || null,
                    scrapedData: body,
                }
            });
        }

        console.log(`[EXTENSION-PUSH] Updated data for SO: ${soNum}`);

        return NextResponse.json({
            success: true,
            message: 'Data logged/updated successfully',
            id: log.id
        }, {
            headers: {
                'Access-Control-Allow-Origin': '*',
            }
        });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('[EXTENSION-PUSH] Error logging data:', error);
        return NextResponse.json(
            { success: false, error: errorMessage },
            { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
        );
    }
}

export async function GET() {
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const logs = await (prisma as any).extensionRawData.findMany({
            orderBy: { updatedAt: 'desc' }, // Show most recently updated first
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

export async function DELETE() {
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (prisma as any).extensionRawData.deleteMany({});
        return NextResponse.json({ success: true, message: 'All logs cleared' });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json(
            { success: false, error: errorMessage },
            { status: 500 }
        );
    }
}
