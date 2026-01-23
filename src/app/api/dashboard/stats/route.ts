import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { startOfMonth, endOfMonth, startOfYear, endOfYear, subDays } from 'date-fns';
import { handleApiError } from '@/lib/api-utils';
import { withTracing } from '@/lib/tracing-utils';

interface GroupByRtomSltsStatus {
    rtom: string;
    sltsStatus: string;
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
            _patLegacy,
            rtomStatsRaw,
            _sltsPatLegacy,
            contractorPerfRaw,
            broughtForward,
            agingRaw,
            sltPatResults
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
            // Legacy/Unused groupbys (keeping position for now to avoid refactoring promise indices)
            Promise.resolve([]),
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
            // Legacy/Unused
            Promise.resolve([]),
            // Contractor Performance (Live)
            (isAdmin || isManager) ? prisma.serviceOrder.groupBy({
                by: ['contractorId', 'sltsStatus'],
                where: { ...baseWhere, contractorId: { not: null } },
                _count: { _all: true }
            }) : Promise.resolve([]),
            // Brought Forward (Pending from before current year)
            prisma.serviceOrder.count({
                where: { ...whereClause, sltsStatus: 'INPROGRESS', receivedDate: { lt: firstDayOfYear } }
            }),
            // Aging breakdown (KPI specific: 3, 5, 7, 10 days)
            Promise.all([
                prisma.serviceOrder.count({ where: { ...whereClause, sltsStatus: 'INPROGRESS', receivedDate: { gte: subDays(now, 3) } } }),
                prisma.serviceOrder.count({ where: { ...whereClause, sltsStatus: 'INPROGRESS', receivedDate: { lt: subDays(now, 3), gte: subDays(now, 5) } } }),
                prisma.serviceOrder.count({ where: { ...whereClause, sltsStatus: 'INPROGRESS', receivedDate: { lt: subDays(now, 5), gte: subDays(now, 7) } } }),
                prisma.serviceOrder.count({ where: { ...whereClause, sltsStatus: 'INPROGRESS', receivedDate: { lt: subDays(now, 7), gte: subDays(now, 10) } } }),
                prisma.serviceOrder.count({ where: { ...whereClause, sltsStatus: 'INPROGRESS', receivedDate: { lt: subDays(now, 10) } } }),
            ]),
            // SLT PAT Status Breakdown (from SLTPATStatus table for high accuracy)
            prisma.sLTPATStatus.groupBy({
                by: ['rtom', 'status', 'source'],
                where: {
                    statusDate: { gte: firstDayOfYear, lte: lastDayOfYear }
                },
                _count: { _all: true }
            })
        ]);

        const monthlyStats = monthlyStatsRaw as any[];
        const totalStats = totalStatsRaw as any[];
        const rtomStats = rtomStatsRaw as unknown as GroupByRtomSltsStatus[];
        const contractorPerf = contractorPerfRaw as any[];

        const stats = {
            monthly: {
                total: monthlyStats.find(s => s.sltsStatus === 'TOTAL')?._count?._all || 0,
                completed: monthlyStats.find(s => s.sltsStatus === 'COMPLETED')?._count?._all || 0,
                pending: monthlyStats.find(s => s.sltsStatus === 'INPROGRESS')?._count?._all || 0,
                returned: monthlyStats.find(s => s.sltsStatus === 'RETURN')?._count?._all || 0,
                invoicable: await prisma.serviceOrder.count({ where: { ...monthlyWhere, isInvoicable: true } }),
            },
            allTime: {
                total: totalStats.find(s => s.sltsStatus === 'TOTAL')?._count?._all || 0,
                completed: totalStats.find(s => s.sltsStatus === 'COMPLETED')?._count?._all || 0,
                returned: totalStats.find(s => s.sltsStatus === 'RETURN')?._count?._all || 0,
                pending: totalStats.find(s => s.sltsStatus === 'INPROGRESS')?._count?._all || 0,
                invoicable: await prisma.serviceOrder.count({ where: { ...whereClause, isInvoicable: true } }),
                broughtForward: broughtForward
            },
            statusBreakdown: [] as { status: string; count: number }[],
            pat: {
                passed: sltPatResults.filter(s => s.status === 'PAT_PASSED').reduce((acc, curr) => acc + (curr._count?._all || 0), 0),
                rejected: sltPatResults.filter(s => s.status === 'REJECTED').reduce((acc, curr) => acc + (curr._count?._all || 0), 0),
                pending: await prisma.serviceOrder.count({ where: { ...whereClause, sltsStatus: 'COMPLETED', hoPatStatus: 'PENDING' } }),
            },
            contractors: [] as ContractorStat[],
            rtoms: [] as RtomStat[],
            aging: [
                { range: '0-3 Days', count: agingRaw[0] },
                { range: '3-5 Days', count: agingRaw[1] },
                { range: '5-7 Days', count: agingRaw[2] },
                { range: '7-10 Days', count: agingRaw[3] },
                { range: '10+ Days', count: agingRaw[4] },
            ]
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
                patPassed: sltPatResults.filter((s) => s.rtom === name && s.status === 'PAT_PASSED').reduce((acc, curr) => acc + (curr._count?._all || 0), 0),
                patRejected: sltPatResults.filter((s) => s.rtom === name && s.status === 'REJECTED' && s.source === 'OPMC_REJECTED').reduce((acc, curr) => acc + (curr._count?._all || 0), 0),
                sltsPatRejected: sltPatResults.filter((s) => s.rtom === name && s.status === 'REJECTED' && s.source === 'HO_REJECTED').reduce((acc, curr) => acc + (curr._count?._all || 0), 0),
            });
        });

        return NextResponse.json(stats);
    } catch (error) {
        return handleApiError(error);
    }
});
