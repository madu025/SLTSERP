import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ soNum: string }> }
) {
    try {
        const { soNum } = await params;


        const serviceOrder = await prisma.serviceOrder.findUnique({
            where: { soNum },
            include: {
                contractor: { select: { name: true } },
                team: { select: { name: true, sltCode: true } },
                materialUsage: {
                    select: {
                        quantity: true,
                        unitPrice: true,
                        usageType: true,
                        serialNumber: true,
                        item: { select: { name: true, code: true, unit: true } }
                    }
                },
                forensicAudit: {
                    select: {
                        auditData: true,
                        voiceTestStatus: true
                    }
                },
                statusHistory: {
                    orderBy: { statusDate: 'desc' },
                    select: {
                        id: true,
                        status: true,
                        statusDate: true,
                        createdAt: true
                    }
                },
                restoreRequests: {
                    orderBy: { createdAt: 'desc' },
                    select: {
                        id: true,
                        reason: true,
                        status: true,
                        createdAt: true
                    }
                },
                commentsHistory: {
                    orderBy: { createdAt: 'desc' },
                    select: {
                        id: true,
                        comment: true,
                        createdAt: true,
                        author: { select: { name: true } }
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
