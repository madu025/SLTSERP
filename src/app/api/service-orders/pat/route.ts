import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { handleApiError } from '@/lib/api-utils';
import { Prisma } from '@prisma/client';

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

        const where: Prisma.SLTPATStatusWhereInput = {};

        if (search) {
            where.soNum = { contains: search, mode: 'insensitive' };
        }

        if (rtom !== 'ALL') {
            where.rtom = rtom;
        }

        if (startDate && endDate) {
            where.statusDate = {
                gte: new Date(startDate),
                lte: new Date(endDate)
            };
        }

        if (status === 'ACCEPTED') {
            where.status = 'PAT_PASSED';
            where.source = 'HO_APPROVED';
        } else if (status === 'REJECTED') {
            where.status = 'REJECTED';
            where.source = 'HO_REJECTED';
        } else if (status === 'OPMC_REJECTED') {
            where.status = 'REJECTED';
            where.source = 'OPMC_REJECTED';
        } else if (status !== 'ALL') {
            where.source = status;
        }

        const [results, total, rtoms] = await Promise.all([
            prisma.sLTPATStatus.findMany({
                where,
                skip,
                take: limit,
                orderBy: { statusDate: 'desc' },
            }),
            prisma.sLTPATStatus.count({
                where
            }),
            prisma.oPMC.findMany({ select: { rtom: true }, orderBy: { rtom: 'asc' } })
        ]);

        // Enrich results with ServiceOrder internal info
        const soNums = results.map(r => r.soNum);
        const internalOrders = await prisma.serviceOrder.findMany({
            where: { soNum: { in: soNums } },
            select: {
                soNum: true,
                sltsStatus: true,
                sltsPatStatus: true,
                isInvoicable: true
            }
        });

        const orders = results.map(r => {
            const internal = internalOrders.find(io => io.soNum === r.soNum);

            return {
                id: r.id,
                soNum: r.soNum,
                rtom: r.rtom,
                lea: r.lea,
                voiceNumber: r.voiceNumber,
                sType: r.sType,
                orderType: r.orderType,
                task: r.task,
                package: r.package,
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
