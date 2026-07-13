import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { startOfMonth, endOfMonth, startOfYear, endOfYear, subDays } from 'date-fns';
import { handleApiError } from '@/lib/api-utils';
import { withTracing } from '@/lib/tracing-utils';

interface RawStat {
    sltsStatus: string;
    _count: { _all: number };
}

interface ContractorRawStat {
    contractorId: string | null;
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

export const GET = withTracing(async (request: Request) => {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');
        const filterRegion = searchParams.get('region') || 'ALL';
        const filterRtom = searchParams.get('rtom') || 'ALL';

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
        const canFilterGlobally = isAdmin || isManager;

        // Fetch all OPMCs for region/rtom mapping
        const allOpmcs = await prisma.oPMC.findMany({
            select: { id: true, rtom: true, region: true },
            orderBy: { rtom: 'asc' }
        });

        // Build RTOM-to-region map and available regions list
        const rtomRegionMap: Record<string, string> = {};
        const availableRegionsSet = new Set<string>();
        allOpmcs.forEach(o => {
            rtomRegionMap[o.rtom] = o.region;
            availableRegionsSet.add(o.region);
        });
        const availableRegions = Array.from(availableRegionsSet).sort();

        // Determine which OPMC IDs this user can access
        let accessibleOpmcIds: string[] = [];
        if (!canFilterGlobally) {
            accessibleOpmcIds = user.accessibleOpmcs.map((o) => o.id);
        }

        // Apply region/rtom filter on top of role-based access
        let filteredOpmcIds: string[] | null = null; // null = no filter (show all)
        if (filterRtom !== 'ALL') {
            const matched = allOpmcs.find(o => o.rtom === filterRtom);
            filteredOpmcIds = matched ? [matched.id] : [];
        } else if (filterRegion !== 'ALL') {
            filteredOpmcIds = allOpmcs.filter(o => o.region === filterRegion).map(o => o.id);
        }

        // Merge role-based and filter-based OPMC restrictions
        const whereClause: Prisma.ServiceOrderWhereInput = {};
        if (!canFilterGlobally) {
            // Non-admin: intersect accessible OPMCs with filter
            const effectiveIds = filteredOpmcIds
                ? accessibleOpmcIds.filter(id => filteredOpmcIds!.includes(id))
                : accessibleOpmcIds;
            whereClause.opmcId = { in: effectiveIds };
        } else if (filteredOpmcIds) {
            // Admin/Manager with region/rtom filter active
            whereClause.opmcId = { in: filteredOpmcIds };
        }

        // Build the set of filtered RTOM strings for PAT status and cached stats filtering
        let filteredRtoms: string[] | null = null; // null = no filter
        if (filterRtom !== 'ALL') {
            filteredRtoms = [filterRtom];
        } else if (filterRegion !== 'ALL') {
            filteredRtoms = allOpmcs.filter(o => o.region === filterRegion).map(o => o.rtom);
        } else if (!canFilterGlobally) {
            filteredRtoms = user.accessibleOpmcs.map((o: any) => o.rtom);
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

        // 0. Fetch pre-calculated stats for the year 2026 (filtered by region/rtom)
        const allCachedRtomStats = await (prisma as any).dashboardStat.findMany() as {
            rtom: string,
            pending: number,
            completed: number,
            returned: number
        }[];
        const cachedRtomStats = filteredRtoms
            ? allCachedRtomStats.filter((r: { rtom: string }) => filteredRtoms!.includes(r.rtom))
            : allCachedRtomStats;

        const [
            monthlyStatsRaw,
            ,
            contractorPerfRaw,
            broughtForward,
            agingRaw,
            sltPatResults
        ] = await Promise.all([
            // Monthly Summary (Current Month) - Still live as it changes fast
            Promise.all([
                prisma.serviceOrder.count({ where: { ...monthlyWhere } }),
                prisma.serviceOrder.count({ where: { ...whereClause, sltsStatus: 'COMPLETED', OR: [{ statusDate: { gte: firstDayOfMonth, lte: lastDayOfMonth } }, { completedDate: { gte: firstDayOfMonth, lte: lastDayOfMonth } }] } }),
                prisma.serviceOrder.count({ where: { ...whereClause, sltsStatus: 'INPROGRESS', OR: [{ receivedDate: { gte: firstDayOfMonth, lte: lastDayOfMonth } }, { statusDate: { gte: firstDayOfMonth, lte: lastDayOfMonth } }] } }),
                prisma.serviceOrder.count({ where: { ...whereClause, sltsStatus: 'RETURN', OR: [{ statusDate: { gte: firstDayOfMonth, lte: lastDayOfMonth } }, { completedDate: { gte: firstDayOfMonth, lte: lastDayOfMonth } }] } }),
            ]).then(([total, completed, pending, returned]) => [
                { sltsStatus: 'TOTAL', _count: { _all: total } },
                { sltsStatus: 'COMPLETED', _count: { _all: completed } },
                { sltsStatus: 'INPROGRESS', _count: { _all: pending } },
                { sltsStatus: 'RETURN', _count: { _all: returned } },
            ]),
            // Legacy mapping
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
            // SLT PAT Status Breakdown (filtered by region/rtom)
            prisma.sLTPATStatus.groupBy({
                by: ['rtom', 'status', 'source'],
                where: {
                    statusDate: { gte: firstDayOfYear, lte: lastDayOfYear },
                    ...(filteredRtoms ? { rtom: { in: filteredRtoms } } : {})
                },
                _count: { _all: true }
            })
        ]);

        const monthlyStats = monthlyStatsRaw as RawStat[];
        const contractorPerf = contractorPerfRaw as ContractorRawStat[];

        // Use cached stats for allTime summary
        const allTimeSummary = cachedRtomStats.reduce((acc, curr) => ({
            pending: acc.pending + curr.pending,
            completed: acc.completed + curr.completed,
            returned: acc.returned + curr.returned,
            total: acc.total + (curr.pending + curr.completed + curr.returned)
        }), { pending: 0, completed: 0, returned: 0, total: 0 });

        const stats = {
            monthly: {
                total: monthlyStats.find(s => s.sltsStatus === 'TOTAL')?._count?._all || 0,
                completed: monthlyStats.find(s => s.sltsStatus === 'COMPLETED')?._count?._all || 0,
                pending: monthlyStats.find(s => s.sltsStatus === 'INPROGRESS')?._count?._all || 0,
                returned: monthlyStats.find(s => s.sltsStatus === 'RETURN')?._count?._all || 0,
                invoicable: await prisma.serviceOrder.count({ where: { ...monthlyWhere, isInvoicable: true } }),
            },
            allTime: {
                total: allTimeSummary.total,
                completed: allTimeSummary.completed,
                returned: allTimeSummary.returned,
                pending: allTimeSummary.pending,
                invoicable: await prisma.serviceOrder.count({ where: { ...whereClause, isInvoicable: true } }),
                broughtForward: broughtForward
            },
            statusBreakdown: [] as { status: string; count: number }[],
            pat: {
                passed: sltPatResults.filter(s => s.status === 'PAT_PASSED').reduce((acc, curr) => acc + (curr._count?._all || 0), 0),
                rejected: sltPatResults.filter(s => s.status === 'PAT_REJECTED' || s.status === 'REJECTED' || s.status === 'PAT_OPMC_REJECTED' || s.status === 'OPMC_REJECTED').reduce((acc, curr) => acc + (curr._count?._all || 0), 0),
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
            where: { ...whereClause, sltsStatus: 'COMPLETED', OR: [{ statusDate: { gte: firstDayOfMonth, lte: lastDayOfMonth } }, { completedDate: { gte: firstDayOfMonth, lte: lastDayOfMonth } }] },
            _count: { _all: true }
        });

        stats.statusBreakdown = (statusBreakdownRaw as unknown as { status: string; _count: { _all: number } }[]).map((s) => ({
            status: s.status,
            count: s._count?._all || 0
        })).sort((a, b) => b.count - a.count);

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

        cachedRtomStats.forEach((r) => {
            stats.rtoms.push({
                name: r.rtom,
                completed: r.completed,
                pending: r.pending,
                returned: r.returned,
                total: r.completed + r.pending + r.returned,
                patPassed: sltPatResults.filter((s) => s.rtom === r.rtom && s.status === 'PAT_PASSED').reduce((acc, curr) => acc + (curr._count?._all || 0), 0),
                patRejected: sltPatResults.filter((s) => s.rtom === r.rtom && (s.status === 'OPMC_REJECTED' || s.status === 'REJECTED' || s.status === 'PAT_OPMC_REJECTED') && (s.source === 'OPMC_REJECTED' || s.source === 'SYNC')).reduce((acc, curr) => acc + (curr._count?._all || 0), 0),
                sltsPatRejected: sltPatResults.filter((s) => s.rtom === r.rtom && (s.status === 'PAT_REJECTED' || s.status === 'REJECTED') && s.source === 'HO_REJECTED').reduce((acc, curr) => acc + (curr._count?._all || 0), 0),
            });
        });


        return NextResponse.json({
            ...stats,
            availableRegions,
            rtomRegionMap,
            userRole: user.role,
            userAccessibleRtoms: user.accessibleOpmcs.map((o: any) => o.rtom)
        });
    } catch (error) {
        return handleApiError(error);
    }
});
