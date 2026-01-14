import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/lib/api-utils';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');
        const search = searchParams.get('search') || '';
        const status = searchParams.get('status') || 'ALL';
        const rtom = searchParams.get('rtom') || 'ALL';
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');
        const skip = (page - 1) * limit;

        const where: any = {};

        if (search) {
            where.soNum = { contains: search, mode: 'insensitive' };
        }

        if (rtom !== 'ALL') {
            where.rtom = rtom;
        }

        if (startDate && endDate) {
            where.createdAt = {
                gte: new Date(startDate),
                lte: new Date(endDate)
            };
        }

        if (status === 'ACCEPTED') {
            where.status = 'PAT_PASSED';
        } else if (status === 'REJECTED') {
            where.status = 'REJECTED';
        } else if (status !== 'ALL') {
            where.source = status;
        }

        const [results, total, rtoms] = await Promise.all([
            (prisma as any).sLTPATStatus.findMany({
                where: {
                    ...(search ? { soNum: { contains: search, mode: 'insensitive' } } : {}),
                    ...(rtom !== 'ALL' ? { rtom } : {}),
                    ...(status !== 'ALL' ? { source: status } : {}),
                    ...(startDate && endDate ? { statusDate: { gte: new Date(startDate), lte: new Date(endDate) } } : {})
                },
                skip,
                take: limit,
                orderBy: { statusDate: 'desc' },
                include: {
                    // Try to link with our local ServiceOrder to show internal status
                }
            }),
            (prisma as any).sLTPATStatus.count({
                where: {
                    ...(search ? { soNum: { contains: search, mode: 'insensitive' } } : {}),
                    ...(rtom !== 'ALL' ? { rtom } : {}),
                    ...(status !== 'ALL' ? { source: status } : {}),
                    ...(startDate && endDate ? { statusDate: { gte: new Date(startDate), lte: new Date(endDate) } } : {})
                }
            }),
            prisma.oPMC.findMany({ select: { rtom: true } })
        ]);

        // Enrich results with ServiceOrder internal info
        const soNums = results.map((r: any) => r.soNum);
        const internalOrders = await prisma.serviceOrder.findMany({
            where: { soNum: { in: soNums } },
            select: {
                soNum: true,
                sltsStatus: true,
                sltsPatStatus: true,
                isInvoicable: true
            }
        });

        const orders = results.map((r: any) => {
            const internal = internalOrders.find(io => io.soNum === r.soNum);

            return {
                id: r.id,
                soNum: r.soNum,
                rtom: r.rtom,
                voiceNumber: r.voiceNumber,
                sType: r.sType,
                orderType: r.orderType,
                conName: r.conName,
                patUser: r.patUser,
                status: r.status,
                statusDate: r.statusDate,
                source: r.source,
                // Internal metadata
                sltsStatus: internal?.sltsStatus || 'NOT_IN_SYSTEM',
                sltsPatStatus: internal?.sltsPatStatus || 'PENDING',
                isInvoicable: internal?.isInvoicable || false
            };
        });

        return NextResponse.json({
            orders,
            total,
            totalPages: Math.ceil(total / limit),
            rtoms: rtoms.map(r => r.rtom)
        });
    } catch (error) {
        return handleApiError(error);
    }
}
