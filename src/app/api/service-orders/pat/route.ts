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

        if (status === 'OPMC_REJECTED') {
            where.opmcPatStatus = 'REJECTED';
        } else if (status === 'HO_APPROVED') {
            where.hoPatStatus = 'PASS';
        } else if (status === 'HO_REJECTED') {
            where.hoPatStatus = 'REJECTED';
        } else if (status === 'PENDING') {
            where.hoPatStatus = { equals: null };
            where.opmcPatStatus = { equals: null };
        }

        // Fetch data in parallel
        const [orders, total, rtoms, rejectedStats] = await Promise.all([
            prisma.serviceOrder.findMany({
                where,
                skip,
                take: limit,
                orderBy: { updatedAt: 'desc' },
                select: {
                    id: true,
                    soNum: true,
                    rtom: true,
                    sltsStatus: true,
                    opmcPatStatus: true,
                    hoPatStatus: true,
                    isInvoicable: true,
                    updatedAt: true
                }
            }),
            prisma.serviceOrder.count({ where }),
            prisma.oPMC.findMany({ select: { rtom: true } }),
            prisma.serviceOrder.groupBy({
                by: ['rtom'],
                where: {
                    OR: [
                        { opmcPatStatus: 'REJECTED' },
                        { hoPatStatus: 'REJECTED' }
                    ]
                },
                _count: { _all: true }
            })
        ]);

        return NextResponse.json({
            orders,
            total,
            totalPages: Math.ceil(total / limit),
            rtoms: rtoms.map(r => r.rtom),
            totalRejected: rejectedStats.reduce((acc, curr) => acc + curr._count._all, 0),
            rejectedSummary: rejectedStats.map(s => ({
                rtom: s.rtom,
                count: s._count._all
            }))
        });
    } catch (error) {
        return handleApiError(error);
    }
}
