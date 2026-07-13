import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// GET: List collected CPEs with filter options
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const contractorId = searchParams.get('contractorId') || undefined;
        const status = searchParams.get('status') || undefined; // PENDING_HANDBACK, HANDED_BACK
        const deviceType = searchParams.get('deviceType') || undefined;

        const whereClause: any = {};
        if (contractorId) whereClause.contractorId = contractorId;
        if (status) whereClause.status = status;
        if (deviceType) whereClause.deviceType = deviceType;

        const cpes = await prisma.collectedCPE.findMany({
            where: whereClause,
            include: {
                serviceOrder: {
                    select: {
                        soNum: true,
                        voiceNumber: true,
                        completedDate: true
                    }
                },
                contractor: {
                    select: {
                        name: true
                    }
                }
            },
            orderBy: {
                collectedDate: 'desc'
            }
        });

        return NextResponse.json({ success: true, data: cpes });

    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error('Error fetching collected CPEs:', error);
        return NextResponse.json({ success: false, message: 'Error fetching collected CPEs', error: msg }, { status: 500 });
    }
}

// POST: Submit a handback receipt to SLT (Bulk mark as HANDED_BACK)
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { ids, handbackReference } = body;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json({ success: false, message: 'IDs array is required' }, { status: 400 });
        }

        if (!handbackReference) {
            return NextResponse.json({ success: false, message: 'Handback reference is required' }, { status: 400 });
        }

        const result = await prisma.$transaction(async (tx) => {
            return await tx.collectedCPE.updateMany({
                where: {
                    id: { in: ids },
                    status: 'PENDING_HANDBACK'
                },
                data: {
                    status: 'HANDED_BACK',
                    handbackDate: new Date(),
                    handbackReference
                }
            });
        });

        return NextResponse.json({ 
            success: true, 
            message: `Successfully handed back ${result.count} CPEs to SLT.`,
            count: result.count 
        });

    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error('Error during CPE handback submission:', error);
        return NextResponse.json({ success: false, message: 'Error during CPE handback submission', error: msg }, { status: 500 });
    }
}
