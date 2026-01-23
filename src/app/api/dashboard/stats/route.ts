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

        // Base filter should be for the year 2026 based on when the order was received or completed
        // We avoid using createdAt because historical data synced today would have today's createdAt
        const yearWhere: Prisma.ServiceOrderWhereInput = {
            OR: [
                { receivedDate: { gte: firstDayOfYear, lte: lastDayOfYear } },
                { statusDate: { gte: firstDayOfYear, lte: lastDayOfYear } }
            ]
        };

        const baseWhere: Prisma.ServiceOrderWhereInput = {
            ...whereClause,
            ...yearWhere
        };

        const monthlyWhere: Prisma.ServiceOrderWhereInput = {
            ...whereClause,
            receivedDate: { gte: firstDayOfMonth, lte: lastDayOfMonth }
        };

        // 0. Remove Pre-calculated Stats dependency for Fresh Start/Global Accuracy
        // We will perform live counts to ensure the user never has to "Fix Stats" again

        const [
            monthlyStatsRaw,
            totalStatsRaw,
            patStatsRaw,
            rtomStatsRaw,
            sltsPatStatsRaw,
            contractorPerfRaw,
            broughtForward
        ] = await Promise.all([
            // Monthly Summary (Current Month)
            Promise.all([
                prisma.serviceOrder.count({ where: { ...monthlyWhere } }),
                prisma.serviceOrder.count({ where: { ...whereClause, status: 'INSTALL_CLOSED', statusDate: { gte: firstDayOfMonth, lte: lastDayOfMonth } } }),
                prisma.serviceOrder.count({ where: { ...whereClause, sltsStatus: 'INPROGRESS', receivedDate: { gte: firstDayOfMonth, lte: lastDayOfMonth } } }),
                prisma.serviceOrder.count({ where: { ...whereClause, sltsStatus: 'RETURN', statusDate: { gte: firstDayOfMonth, lte: lastDayOfMonth } } }),
            ]).then(([total, completed, pending, returned]) => [
                { sltsStatus: 'TOTAL', _count: { _all: total } },
                { sltsStatus: 'COMPLETED', _count: { _all: completed } },
                { sltsStatus: 'INPROGRESS', _count: { _all: pending } },
                { sltsStatus: 'RETURN', _count: { _all: returned } },
            ]),
            // Yearly Summary (2026) - Categorized by respective dates
            Promise.all([
                prisma.serviceOrder.count({ where: { ...whereClause, receivedDate: { gte: firstDayOfYear, lte: lastDayOfYear } } }),
                prisma.serviceOrder.count({ where: { ...whereClause, status: 'INSTALL_CLOSED', statusDate: { gte: firstDayOfYear, lte: lastDayOfYear } } }),
                prisma.serviceOrder.count({ where: { ...whereClause, sltsStatus: 'INPROGRESS', receivedDate: { gte: firstDayOfYear, lte: lastDayOfYear } } }),
                prisma.serviceOrder.count({ where: { ...whereClause, sltsStatus: 'RETURN', statusDate: { gte: firstDayOfYear, lte: lastDayOfYear } } }),
            ]).then(([total, completed, pending, returned]) => [
                { sltsStatus: 'TOTAL', _count: { _all: total } },
                { sltsStatus: 'COMPLETED', _count: { _all: completed } },
                { sltsStatus: 'INPROGRESS', _count: { _all: pending } },
                { sltsStatus: 'RETURN', _count: { _all: returned } },
            ]),
            // PAT Stats (Live)
            prisma.serviceOrder.groupBy({
                by: ['rtom', 'patStatus'],
                where: baseWhere,
                _count: { _all: true }
            }),
            // RTOM/Region breakdown (Live) - Categorized by their respective dates
            Promise.all([
                prisma.serviceOrder.groupBy({
                    by: ['rtom'],
                    where: { ...whereClause, sltsStatus: 'INPROGRESS', receivedDate: { gte: firstDayOfYear, lte: lastDayOfYear } },
                    _count: { _all: true }
                }),
                prisma.serviceOrder.groupBy({
                    by: ['rtom'],
                    where: { ...whereClause, status: 'INSTALL_CLOSED', statusDate: { gte: firstDayOfYear, lte: lastDayOfYear } },
                    _count: { _all: true }
                }),
                prisma.serviceOrder.groupBy({
                    by: ['rtom'],
                    where: { ...whereClause, sltsStatus: 'RETURN', statusDate: { gte: firstDayOfYear, lte: lastDayOfYear } },
                    _count: { _all: true }
                }),
            ]).then(([pending, completed, returned]) => {
                const results: any[] = [];
                pending.forEach(p => results.push({ rtom: p.rtom, sltsStatus: 'INPROGRESS', _count: { _all: p._count._all } }));
                completed.forEach(c => results.push({ rtom: c.rtom, sltsStatus: 'COMPLETED', _count: { _all: c._count._all } }));
                returned.forEach(r => results.push({ rtom: r.rtom, sltsStatus: 'RETURN', _count: { _all: r._count._all } }));
                return results;
            }),
            // SLTS PAT stats (Live)
            prisma.serviceOrder.groupBy({
                by: ['rtom', 'sltsPatStatus'],
                where: baseWhere,
                _count: { _all: true }
            }),
            // Contractor Performance (Live)
            (isAdmin || isManager) ? prisma.serviceOrder.groupBy({
                by: ['contractorId', 'sltsStatus'],
                where: { ...baseWhere, contractorId: { not: null } },
                _count: { _all: true }
            }) : Promise.resolve([]),
            // Brought Forward (Pending from before current year)
            prisma.serviceOrder.count({
                where: { ...whereClause, sltsStatus: 'INPROGRESS', receivedDate: { lt: firstDayOfYear } }
            })
        ]);

        const monthlyStats = monthlyStatsRaw as unknown as GroupBySltsStatus[];
        const totalStats = totalStatsRaw as unknown as GroupBySltsStatus[];
        const patStats = patStatsRaw as unknown as GroupByRtomPatStatus[];
        const contractorPerf = contractorPerfRaw as unknown as GroupByContractorSltsStatus[];
        const rtomStats = rtomStatsRaw as unknown as GroupByRtomSltsStatus[];
        const sltsPatStats = sltsPatStatsRaw as unknown as GroupByRtomSltsPatStatus[];

        const stats = {
            monthly: {
                total: monthlyStats.find(s => s.sltsStatus === 'TOTAL')?._count?._all || 0,
                completed: monthlyStats.find(s => s.sltsStatus === 'COMPLETED')?._count?._all || 0,
                pending: monthlyStats.find(s => s.sltsStatus === 'INPROGRESS')?._count?._all || 0,
                returned: monthlyStats.find(s => s.sltsStatus === 'RETURN')?._count?._all || 0,
                invoicable: await prisma.serviceOrder.count({ where: { ...monthlyWhere, isInvoicable: true } }),
            },
            allTime: {
                total: totalStats.reduce((acc, curr) => acc + (curr._count?._all || 0), 0),
                completed: totalStats.find(s => s.sltsStatus === 'COMPLETED')?._count?._all || 0,
                returned: totalStats.find(s => s.sltsStatus === 'RETURN')?._count?._all || 0,
                pending: totalStats.find(s => s.sltsStatus === 'INPROGRESS')?._count?._all || 0,
                invoicable: await prisma.serviceOrder.count({ where: { ...whereClause, isInvoicable: true } }),
                broughtForward: broughtForward
            },
            statusBreakdown: [] as { status: string; count: number }[],
            pat: {
                passed: patStats.filter(s => s.patStatus === 'PASS' || s.patStatus === 'PAT_PASSED').reduce((acc, curr) => acc + (curr._count?._all || 0), 0),
                rejected: patStats.filter(s => s.patStatus === 'REJECTED').reduce((acc, curr) => acc + (curr._count?._all || 0), 0),
                pending: patStats.filter(s => s.patStatus === 'PENDING').reduce((acc, curr) => acc + (curr._count?._all || 0), 0),
            },
            contractors: [] as ContractorStat[],
            rtoms: [] as RtomStat[]
        };

        // 1. Fetch Completion Status Breakdown (for current month)
        const statusBreakdownRaw = await prisma.serviceOrder.groupBy({
            by: ['status'],
            where: { ...whereClause, sltsStatus: 'COMPLETED', statusDate: { gte: firstDayOfMonth, lte: lastDayOfMonth } },
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
                patPassed: patStats.filter((s) => s.rtom === name && (s.patStatus === 'PASS' || s.patStatus === 'PAT_PASSED')).reduce((acc, curr) => acc + (curr._count?._all || 0), 0),
                patRejected: patStats.filter((s) => s.rtom === name && s.patStatus === 'REJECTED').reduce((acc, curr) => acc + (curr._count?._all || 0), 0),
                sltsPatRejected: sltsPatStats.filter((s) => s.rtom === name && s.sltsPatStatus === 'REJECTED').reduce((acc, curr) => acc + (curr._count?._all || 0), 0),
            });
        });

        return NextResponse.json(stats);
    } catch (error) {
        return handleApiError(error);
    }
});
