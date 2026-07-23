import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { startOfMonth, endOfMonth, startOfYear, endOfYear, subDays } from 'date-fns';
import { AppError } from '@/lib/error';

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
    revenue: number;
    patPassed?: number;
    patRejected?: number;
    sltsPatRejected?: number;
}

export class ServiceOrderDashboardService {
    static async getServiceOrderStats(params: { userId: string, filterRegion: string, filterRtom: string }) {
        const { userId, filterRegion, filterRtom } = params;

        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                accessibleOpmcs: true
            }
        });

        if (!user) {
            throw AppError.notFound('User not found');
        }

        const isAdmin = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN';
        const isManager = user.role === 'MANAGER' || user.role === 'SA_MANAGER' || user.role === 'OSP_MANAGER';
        const canFilterGlobally = isAdmin || isManager;

        const allOpmcs = await prisma.oPMC.findMany({
            select: { id: true, rtom: true, region: true },
            orderBy: { rtom: 'asc' }
        });

        const rtomRegionMap: Record<string, string> = {};
        const availableRegionsSet = new Set<string>();
        allOpmcs.forEach(o => {
            rtomRegionMap[o.rtom] = o.region;
            availableRegionsSet.add(o.region);
        });
        const availableRegions = Array.from(availableRegionsSet).sort();

        let accessibleOpmcIds: string[] = [];
        if (!canFilterGlobally) {
            accessibleOpmcIds = user.accessibleOpmcs.map((o: { id: string; rtom: string }) => o.id);
        }

        let filteredOpmcIds: string[] | null = null;
        if (filterRtom !== 'ALL') {
            const matched = allOpmcs.find(o => o.rtom === filterRtom);
            filteredOpmcIds = matched ? [matched.id] : [];
        } else if (filterRegion !== 'ALL') {
            filteredOpmcIds = allOpmcs.filter(o => o.region === filterRegion).map(o => o.id);
        }

        const whereClause: Prisma.ServiceOrderWhereInput = {};
        if (!canFilterGlobally) {
            const effectiveIds = filteredOpmcIds
                ? accessibleOpmcIds.filter(id => filteredOpmcIds!.includes(id))
                : accessibleOpmcIds;
            whereClause.opmcId = { in: effectiveIds };
        } else if (filteredOpmcIds) {
            whereClause.opmcId = { in: filteredOpmcIds };
        }

        let filteredRtoms: string[] | null = null;
        if (filterRtom !== 'ALL') {
            filteredRtoms = [filterRtom];
        } else if (filterRegion !== 'ALL') {
            filteredRtoms = allOpmcs.filter(o => o.region === filterRegion).map(o => o.rtom);
        } else if (!canFilterGlobally) {
            filteredRtoms = user.accessibleOpmcs.map((o: { id: string; rtom: string }) => o.rtom);
        }

        const now = new Date();
        const firstDayOfMonth = startOfMonth(now);
        const lastDayOfMonth = endOfMonth(now);
        const firstDayOfYear = startOfYear(now);
        const lastDayOfYear = endOfYear(now);

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

        const realTimeRtomGrouped = await prisma.serviceOrder.groupBy({
            by: ['opmcId', 'sltsStatus'],
            where: { ...whereClause },
            _count: { _all: true },
            _sum: { revenueAmount: true }
        });

        const rtomOpmcMap = new Map(allOpmcs.map(o => [o.id, o.rtom]));
        const rtomStatsMap: Record<string, { rtom: string; pending: number; completed: number; returned: number; revenue: number }> = {};

        allOpmcs.forEach(o => {
            if (!filteredRtoms || filteredRtoms.includes(o.rtom)) {
                if (!rtomStatsMap[o.rtom]) {
                    rtomStatsMap[o.rtom] = { rtom: o.rtom, pending: 0, completed: 0, returned: 0, revenue: 0 };
                }
            }
        });

        realTimeRtomGrouped.forEach(g => {
            const rtom = rtomOpmcMap.get(g.opmcId || '');
            if (rtom && rtomStatsMap[rtom]) {
                if (g.sltsStatus === 'COMPLETED' || g.sltsStatus === 'PROV_CLOSED' || g.sltsStatus === 'INSTALL_CLOSED') {
                    rtomStatsMap[rtom].completed += g._count._all;
                    const revVal = Number(g._sum?.revenueAmount || 0);
                    rtomStatsMap[rtom].revenue += revVal > 0 ? revVal : (g._count._all * 6500); // 6,500 LKR standard revenue rate per completed SOD
                } else if (g.sltsStatus === 'RETURN') {
                    rtomStatsMap[rtom].returned += g._count._all;
                } else {
                    rtomStatsMap[rtom].pending += g._count._all;
                }
            }
        });

        const cachedRtomStats = Object.values(rtomStatsMap);

        const [
            monthlyStatsRaw,
            ,
            contractorPerfRaw,
            broughtForward,
            agingRaw,
            sltPatResults
        ] = await Promise.all([
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
            Promise.resolve([]),
            (isAdmin || isManager) ? prisma.serviceOrder.groupBy({
                by: ['contractorId', 'sltsStatus'],
                where: { ...baseWhere, contractorId: { not: null } },
                _count: { _all: true }
            }) : Promise.resolve([]),
            prisma.serviceOrder.count({
                where: { ...whereClause, sltsStatus: 'INPROGRESS', receivedDate: { lt: firstDayOfYear } }
            }),
            Promise.all([
                prisma.serviceOrder.count({ where: { ...whereClause, sltsStatus: 'INPROGRESS', receivedDate: { gte: subDays(now, 3) } } }),
                prisma.serviceOrder.count({ where: { ...whereClause, sltsStatus: 'INPROGRESS', receivedDate: { lt: subDays(now, 3), gte: subDays(now, 5) } } }),
                prisma.serviceOrder.count({ where: { ...whereClause, sltsStatus: 'INPROGRESS', receivedDate: { lt: subDays(now, 5), gte: subDays(now, 7) } } }),
                prisma.serviceOrder.count({ where: { ...whereClause, sltsStatus: 'INPROGRESS', receivedDate: { lt: subDays(now, 7), gte: subDays(now, 10) } } }),
                prisma.serviceOrder.count({ where: { ...whereClause, sltsStatus: 'INPROGRESS', receivedDate: { lt: subDays(now, 10) } } }),
            ]),
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

        const allTimeSummary = cachedRtomStats.reduce((acc, curr) => ({
            pending: acc.pending + curr.pending,
            completed: acc.completed + curr.completed,
            returned: acc.returned + curr.returned,
            total: acc.total + (curr.pending + curr.completed + curr.returned)
        }), { pending: 0, completed: 0, returned: 0, total: 0 });

        const [
            financialAggregates,
            slaBreachedCount,
            invoicedAggregates,
            pendingInvoiceAggregates,
            uninvoicedSodAggregates,
            activeVehiclesCount,
            monthlyTripsCount,
            pendingVehiclePaymentAggregates,
            pendingSurveyRequestsCount,
            totalVendorsCount
        ] = await Promise.all([
            prisma.serviceOrder.aggregate({
                where: { ...monthlyWhere, sltsStatus: 'COMPLETED' },
                _sum: {
                    revenueAmount: true,
                    contractorAmount: true
                }
            }),
            prisma.serviceOrder.count({
                where: { ...whereClause, sltsStatus: 'INPROGRESS', receivedDate: { lt: subDays(now, 2) } }
            }),
            prisma.invoice.aggregate({ _sum: { totalAmount: true } }).catch(() => ({ _sum: { totalAmount: 0 } })),
            prisma.invoice.aggregate({ where: { status: 'PENDING' }, _count: { _all: true }, _sum: { totalAmount: true } }).catch(() => ({ _count: { _all: 0 }, _sum: { totalAmount: 0 } })),
            prisma.serviceOrder.aggregate({ where: { ...whereClause, sltsStatus: 'COMPLETED', isInvoicable: true, invoiceId: null }, _sum: { revenueAmount: true } }).catch(() => ({ _sum: { revenueAmount: 0 } })),
            (prisma as any).vMVehicle?.count({ where: { status: 'AVAILABLE' } }).catch(() => 0) ?? Promise.resolve(0),
            (prisma as any).vMTrip?.count({ where: { createdAt: { gte: firstDayOfMonth } } }).catch(() => 0) ?? Promise.resolve(0),
            (prisma as any).vMPayment?.aggregate({ where: { status: 'PENDING' }, _sum: { total_amount: true } }).catch(() => ({ _sum: { total_amount: 0 } })) ?? Promise.resolve({ _sum: { total_amount: 0 } }),
            (prisma as any).surveyRequest?.count({ where: { status: 'PENDING' } }).catch(() => 0) ?? Promise.resolve(0),
            (prisma as any).vendor?.count().catch(() => 0) ?? Promise.resolve(0)
        ]);

        const totalRevenue = Number(financialAggregates._sum.revenueAmount || 0);
        const totalContractorCost = Number(financialAggregates._sum.contractorAmount || 0);
        const netMargin = totalRevenue - totalContractorCost;
        const marginPercentage = totalRevenue > 0 ? Math.round((netMargin / totalRevenue) * 100) : 0;

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
            financials: {
                totalRevenue,
                totalContractorCost,
                netMargin,
                marginPercentage
            },
            financeSummary: {
                invoicedTotal: Number(invoicedAggregates._sum.totalAmount || 0),
                pendingInvoices: Number(pendingInvoiceAggregates._count._all || 0),
                pendingInvoiceAmount: Number(pendingInvoiceAggregates._sum.totalAmount || 0),
                uninvoicedCompletedAmount: Number(uninvoicedSodAggregates._sum.revenueAmount || 0)
            },
            vehicleSummary: {
                activeVehicles: Number(activeVehiclesCount || 0),
                monthlyTrips: Number(monthlyTripsCount || 0),
                pendingVehiclePayments: Number(pendingVehiclePaymentAggregates._sum?.total_amount || 0)
            },
            procurementSummary: {
                pendingApprovals: Number(pendingSurveyRequestsCount || 0),
                totalVendors: Number(totalVendorsCount || 0)
            },
            sla: {
                slaBreachedCount,
                targetSlaPercentage: 95
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
                revenue: r.revenue,
                patPassed: sltPatResults.filter((s) => s.rtom === r.rtom && s.status === 'PAT_PASSED').reduce((acc, curr) => acc + (curr._count?._all || 0), 0),
                patRejected: sltPatResults.filter((s) => s.rtom === r.rtom && (s.status === 'OPMC_REJECTED' || s.status === 'REJECTED' || s.status === 'PAT_OPMC_REJECTED') && (s.source === 'OPMC_REJECTED' || s.source === 'SYNC')).reduce((acc, curr) => acc + (curr._count?._all || 0), 0),
                sltsPatRejected: sltPatResults.filter((s) => s.rtom === r.rtom && (s.status === 'PAT_REJECTED' || s.status === 'REJECTED') && s.source === 'HO_REJECTED').reduce((acc, curr) => acc + (curr._count?._all || 0), 0),
            });
        });

        return {
            ...stats,
            availableRegions,
            rtomRegionMap,
            userRole: user.role,
            userAccessibleRtoms: user.accessibleOpmcs.map((o: any) => o.rtom)
        };
    }
}
