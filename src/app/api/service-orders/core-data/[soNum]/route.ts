import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
    request: Request,
    { params }: { params: { soNum: string } }
) {
    try {
        const { soNum } = params;

        const serviceOrder = await prisma.serviceOrder.findUnique({
            where: { soNum },
            include: {
                contractor: { select: { name: true } },
                materialUsage: {
                    select: {
                        quantity: true,
                        unitPrice: true,
                        usageType: true,
                        item: { select: { name: true, code: true, unit: true } }
                    }
                },
                forensicAudit: {
                    select: {
                        auditData: true,
                        voiceTestStatus: true
                    }
                }
            }
        });

        if (!serviceOrder) {
            return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 });
        }

        return NextResponse.json({ success: true, data: serviceOrder });
    } catch (error) {
        console.error('Error fetching core SO data:', error);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}
