import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { handleApiError } from '@/lib/api-utils';
import { withTracing } from '@/lib/tracing-utils';

interface GroupBySltsStatus {
    sltsStatus: string;
    _count: { _all: number };
}

interface GroupByRtomPatStatus {
    rtom: string;
    patStatus: string | null;
    _count: { _all: number };
}

interface GroupByContractorSltsStatus {
    contractorId: string | null;
    sltsStatus: string;
    _count: { _all: number };
}

interface GroupByRtomSltsStatus {
    rtom: string;
    sltsStatus: string;
    _count: { _all: number };
}

interface GroupByRtomSltsPatStatus {
    rtom: string;
    sltsPatStatus: string | null;
    _count: { _all: number };
}

interface ContractorStat {
    name: string;
    completed: number;
    total: number;
    percentage: number;
}

interface RtomStat {
    name: string;
    completed: number;
    pending: number;
    returned: number;
    total: number;
    patPassed?: number;
    patRejected?: number;
    sltsPatRejected?: number;
}

export const GET = withTracing(async (request: any) => {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');

        if (!userId) {
            return NextResponse.json({ message: 'User ID required' }, { status: 400 });
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                accessibleOpmcs: true
            }
        });

        if (!user) {
            return NextResponse.json({ message: 'User not found' }, { status: 404 });
        }

        const isAdmin = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN';
        const isManager = user.role === 'MANAGER' || user.role === 'SA_MANAGER' || user.role === 'OSP_MANAGER';

        const whereClause: Prisma.ServiceOrderWhereInput = {};
        if (!isAdmin && !isManager) {
            const accessibleOpmcIds = user.accessibleOpmcs.map((o) => o.id);
            whereClause.opmcId = { in: accessibleOpmcIds };
        }

        const now = new Date();
        const firstDayOfMonth = startOfMonth(now);
        const lastDayOfMonth = endOfMonth(now);
        const firstDayOfYear = startOfYear(now);
        const lastDayOfYear = endOfYear(now);

        whereClause.createdAt = {
            gte: firstDayOfYear,
            lte: lastDayOfYear
        };

        const monthlyWhere: Prisma.ServiceOrderWhereInput = {
            ...whereClause,
            receivedDate: { gte: firstDayOfMonth, lte: lastDayOfMonth }
        };

        // 0. Fetch Pre-calculated Stats
        const cachedStats = await (prisma as any).dashboardStat.findMany({
            where: whereClause.opmcId ? { opmcId: whereClause.opmcId } : {}
        });

        const [
            monthlyStatsRaw,
            contractorPerfRaw
        ] = await Promise.all([
            // Use monthlyWhere (receivedDate) for total/pending, and statusDate for completed/returned
            Promise.all([
                prisma.serviceOrder.count({ where: { ...monthlyWhere } }),
                prisma.serviceOrder.count({ where: { ...whereClause, sltsStatus: 'COMPLETED', statusDate: { gte: firstDayOfMonth, lte: lastDayOfMonth } } }),
                prisma.serviceOrder.count({ where: { ...whereClause, sltsStatus: 'INPROGRESS', receivedDate: { gte: firstDayOfMonth, lte: lastDayOfMonth } } }),
                prisma.serviceOrder.count({ where: { ...whereClause, sltsStatus: 'RETURN', statusDate: { gte: firstDayOfMonth, lte: lastDayOfMonth } } }),
            ]).then(([total, completed, pending, returned]) => [
                { sltsStatus: 'TOTAL', _count: { _all: total } },
                { sltsStatus: 'COMPLETED', _count: { _all: completed } },
                { sltsStatus: 'INPROGRESS', _count: { _all: pending } },
                { sltsStatus: 'RETURN', _count: { _all: returned } },
            ]),
            (isAdmin || isManager) ? prisma.serviceOrder.groupBy({
                by: ['contractorId', 'sltsStatus'],
                where: { ...whereClause, contractorId: { not: null } },
                _count: { _all: true }
            }) : Promise.resolve([])
        ]);

        const totalStatsRaw = [
            { sltsStatus: 'INPROGRESS', _count: { _all: cachedStats.reduce((acc: number, curr: any) => acc + curr.pending, 0) } },
            { sltsStatus: 'COMPLETED', _count: { _all: cachedStats.reduce((acc: number, curr: any) => acc + curr.completed, 0) } },
            { sltsStatus: 'RETURN', _count: { _all: cachedStats.reduce((acc: number, curr: any) => acc + curr.returned, 0) } },
        ];

        const patStatsRaw: any[] = [];
        const rtomStatsRaw: any[] = [];
        const sltsPatStatsRaw: any[] = [];

        cachedStats.forEach((s: any) => {
            patStatsRaw.push({ rtom: s.rtom, patStatus: 'PASS', _count: { _all: s.patPassed } });
            patStatsRaw.push({ rtom: s.rtom, patStatus: 'REJECTED', _count: { _all: s.patRejected } });

            rtomStatsRaw.push({ rtom: s.rtom, sltsStatus: 'COMPLETED', _count: { _all: s.completed } });
            rtomStatsRaw.push({ rtom: s.rtom, sltsStatus: 'INPROGRESS', _count: { _all: s.pending } });
            rtomStatsRaw.push({ rtom: s.rtom, sltsStatus: 'RETURN', _count: { _all: s.returned } });

            sltsPatStatsRaw.push({ rtom: s.rtom, sltsPatStatus: 'REJECTED', _count: { _all: s.sltsPatRejected } });
        });

        const monthlyStats = monthlyStatsRaw as unknown as GroupBySltsStatus[];
        const totalStats = totalStatsRaw as unknown as GroupBySltsStatus[];
        const patStats = patStatsRaw as unknown as GroupByRtomPatStatus[];
        const contractorPerf = contractorPerfRaw as unknown as GroupByContractorSltsStatus[];
        const rtomStats = rtomStatsRaw as unknown as GroupByRtomSltsStatus[];
        const sltsPatStats = sltsPatStatsRaw as unknown as GroupByRtomSltsPatStatus[];

        const stats = {
            monthly: {
                total: monthlyStats.reduce((acc, curr) => acc + (curr._count?._all || 0), 0),
                completed: monthlyStats.find(s => s.sltsStatus === 'COMPLETED')?._count?._all || 0,
                pending: monthlyStats.find(s => s.sltsStatus === 'INPROGRESS')?._count?._all || 0,
                returned: monthlyStats.find(s => s.sltsStatus === 'RETURN')?._count?._all || 0,
                invoicable: await prisma.serviceOrder.count({ where: { ...whereClause, createdAt: { gte: firstDayOfMonth, lte: lastDayOfMonth }, isInvoicable: true } }),
            },
            allTime: {
                total: totalStats.reduce((acc, curr) => acc + (curr._count?._all || 0), 0),
                completed: totalStats.find(s => s.sltsStatus === 'COMPLETED')?._count?._all || 0,
                returned: totalStats.find(s => s.sltsStatus === 'RETURN')?._count?._all || 0,
                pending: totalStats.find(s => s.sltsStatus === 'INPROGRESS')?._count?._all || 0,
                invoicable: await prisma.serviceOrder.count({ where: { ...whereClause, isInvoicable: true } }),
            },
            statusBreakdown: [] as { status: string; count: number }[],
            pat: {
                passed: patStats.find(s => s.patStatus === 'PASS' || s.patStatus === 'PAT_PASSED')?._count?._all || 0,
                rejected: patStats.find(s => s.patStatus === 'REJECTED')?._count?._all || 0,
                pending: patStats.find(s => s.patStatus === 'PENDING')?._count?._all || 0,
            },
            contractors: [] as ContractorStat[],
            rtoms: [] as RtomStat[]
        };

        // 1. Fetch Completion Status Breakdown (for current month)
        const statusBreakdownRaw = await prisma.serviceOrder.groupBy({
            by: ['status'],
            where: { ...whereClause, sltsStatus: 'COMPLETED', createdAt: { gte: firstDayOfMonth, lte: lastDayOfMonth } },
            _count: { _all: true }
        });

        stats.statusBreakdown = statusBreakdownRaw.map((s: any) => ({
            status: s.status,
            count: s._count?._all || 0
        })).sort((a: any, b: any) => b.count - a.count);

        const contractorIds = [...new Set(contractorPerf.map((c) => c.contractorId))].filter(Boolean) as string[];
        const contractorsData = await prisma.contractor.findMany({
            where: { id: { in: contractorIds } },
            select: { id: true, name: true }
        });

        contractorIds.forEach(cId => {
            const cName = contractorsData.find(c => c.id === cId)?.name || 'Unknown';
            const completed = contractorPerf.find((p) => p.contractorId === cId && p.sltsStatus === 'COMPLETED')?._count?._all || 0;
            const total = contractorPerf.filter((p) => p.contractorId === cId).reduce((acc: number, curr) => acc + (curr._count?._all || 0), 0);
            stats.contractors.push({
                name: cName,
                completed,
                total,
                percentage: total > 0 ? Math.round((completed / total) * 100) : 0
            });
        });

        const rtomNames = [...new Set(rtomStats.map((r) => r.rtom))] as string[];
        rtomNames.forEach(name => {
            const completed = rtomStats.find((r) => r.rtom === name && r.sltsStatus === 'COMPLETED')?._count?._all || 0;
            const pending = rtomStats.find((r) => r.rtom === name && r.sltsStatus === 'INPROGRESS')?._count?._all || 0;
            const returned = rtomStats.find((r) => r.rtom === name && r.sltsStatus === 'RETURN')?._count?._all || 0;
            const rtomTotal = rtomStats.filter((r) => r.rtom === name).reduce((acc: number, curr) => acc + (curr._count?._all || 0), 0);

            stats.rtoms.push({
                name,
                completed,
                pending,
                returned,
                total: rtomTotal,
                patPassed: patStats.find((s) => s.rtom === name && s.patStatus === 'PASS')?._count?._all || 0,
                patRejected: patStats.find((s) => s.rtom === name && s.patStatus === 'REJECTED')?._count?._all || 0,
                sltsPatRejected: sltsPatStats.find((s) => s.rtom === name && s.sltsPatStatus === 'REJECTED')?._count?._all || 0,
            });
        });

        return NextResponse.json(stats);
    } catch (error) {
        return handleApiError(error);
    }
});
