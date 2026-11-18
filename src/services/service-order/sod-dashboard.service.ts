import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { deriveEffectivePermissions } from '@/lib/effective-permissions';
import { resolveOpmcScope } from '@/lib/opmc-scope';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { startOfMonth, endOfMonth, startOfYear, endOfYear, subDays } from 'date-fns';
import { AppError } from '@/lib/error';
import { SOD_FINANCIAL_COMPLETION_STATUSES } from '@/lib/constants/sod-constants';

interface RawStat {
    sltsStatus: string;
    _count: { _all: number };
}

interface ContractorRawStat {
    contractorId: string | null;
    sltsStatus?: string;
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

const STATS_CACHE = new Map<string, { promise: Promise<unknown>, expiresAt: number }>();
const CACHE_TTL_MS = 60 * 1000; // 60 seconds

export class ServiceOrderDashboardService {
    static async getDashboardFilterMetadata(userId: string) {
        const [user, allOpmcs, accessibleOpmcScope] = await Promise.all([
            prisma.user.findUnique({
                where: { id: userId },
                select: {
                    accessibleOpmcs: {
                        select: { rtom: true }
                    }
                }
            }),
            prisma.oPMC.findMany({
                select: { id: true, rtom: true, region: true },
                orderBy: { rtom: 'asc' }
            }),
            resolveOpmcScope(userId)
        ]);

        if (!user) {
            throw AppError.notFound('User not found');
        }

        // Filter metadata must obey the same capability-derived OPMC scope as
        // the dashboard aggregates. Region/RTOM names are not data rows, but
        // returning only visible options also prevents misleading filters.
        const visibleOpmcIds = accessibleOpmcScope === undefined
            ? undefined
            : new Set(accessibleOpmcScope);
        const visibleOpmcs = visibleOpmcIds === undefined
            ? allOpmcs
            : allOpmcs.filter(opmc => visibleOpmcIds.has(opmc.id));

        const rtomRegionMap: Record<string, string> = {};
        const availableRegions = new Set<string>();
        visibleOpmcs.forEach(opmc => {
            rtomRegionMap[opmc.rtom] = opmc.region;
            availableRegions.add(opmc.region);
        });

        return {
            availableRegions: Array.from(availableRegions).sort(),
            rtomRegionMap,
            userAccessibleRtoms: Array.from(new Set(user.accessibleOpmcs.map(opmc => opmc.rtom))).sort()
        };
    }

    static async getServiceOrderStats(params: { userId: string, filterRegion: string, filterRtom: string }) {
        const { userId, filterRegion, filterRtom } = params;
        const cacheKey = `${userId}_${filterRegion}_${filterRtom}`;

        const cached = STATS_CACHE.get(cacheKey);
        if (cached && cached.expiresAt > Date.now()) {
            return cached.promise;
        }

        // Create the promise and store it immediately so other concurrent requests wait on this exact promise
        const fetchPromise = (async () => {
            const user = await prisma.user.findUnique({
                where: { id: userId },
            include: {
                accessibleOpmcs: true,
                systemRole: {
                    select: {
                        isActive: true,
                        permissions: true,
                        rolePermissions: { select: { permission: true, permissionDefinition: { select: { code: true } } } }
                    }
                },
                sectionAssignments: {
                    select: {
                        role: {
                            select: {
                                isActive: true,
                                permissions: true,
                                rolePermissions: { select: { permission: true, permissionDefinition: { select: { code: true } } } }
                            }
                        }
                    }
                }
            }
        });

        if (!user) {
            throw AppError.notFound('User not found');
        }

        // Scope and global access are derived from DB-backed capabilities, not
        // from legacy role-name lists. This keeps dashboard visibility aligned
        // with the same RBAC source used by API route guards.
        const effectivePermissions = deriveEffectivePermissions(user);
        const accessibleOpmcScope = await resolveOpmcScope(userId);
        const canFilterGlobally = accessibleOpmcScope === undefined;
        const canViewContractorPerformance =
            canFilterGlobally || effectivePermissions.includes(RBAC_PERMISSIONS.SOD_READ);

        const allOpmcs = await prisma.oPMC.findMany({
            select: { id: true, rtom: true, region: true },
            orderBy: { rtom: 'asc' }
        });

        // Keep filter metadata inside the same OPMC boundary as the metrics.
        // Counts were already scoped, but exposing every RTOM/region here let
        // scoped users discover out-of-scope organizational names.
        const scopedOpmcIds = canFilterGlobally ? undefined : (accessibleOpmcScope ?? []);
        const visibleOpmcs = scopedOpmcIds === undefined
            ? allOpmcs
            : allOpmcs.filter(opmc => scopedOpmcIds.includes(opmc.id));
        const rtomRegionMap: Record<string, string> = {};
        const availableRegionsSet = new Set<string>();
        visibleOpmcs.forEach(o => {
            rtomRegionMap[o.rtom] = o.region;
            availableRegionsSet.add(o.region);
        });
        const availableRegions = Array.from(availableRegionsSet).sort();

        let filteredOpmcIds: string[] | null = null;
        if (filterRtom !== 'ALL') {
            // An RTOM can own multiple OPMCs. Filtering by the first match
            // under-counted operational totals and revenue for the remaining
            // OPMCs in that RTOM.
            filteredOpmcIds = allOpmcs.filter(o => o.rtom === filterRtom).map(o => o.id);
        } else if (filterRegion !== 'ALL') {
            filteredOpmcIds = allOpmcs.filter(o => o.region === filterRegion).map(o => o.id);
        }

        const whereClause: Prisma.ServiceOrderWhereInput = {};
        if (!canFilterGlobally) {
            const effectiveIds = filteredOpmcIds
                ? scopedOpmcIds!.filter(id => filteredOpmcIds!.includes(id))
                : scopedOpmcIds!;
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

        // Regional isolation (fail-closed): non-global users must never see data
        // for RTOMs outside their accessible OPMCs. Out-of-scope rtom/region
        // filters intersect to an empty set so invoice/PAT aggregates cannot leak.
        if (!canFilterGlobally) {
            const accessibleRtoms = new Set(user.accessibleOpmcs.map((o: { rtom: string }) => o.rtom));
            filteredRtoms = (filteredRtoms ?? [...accessibleRtoms]).filter(r => accessibleRtoms.has(r));
        }

        // Invoice scope for regionally-scoped users: restrict to their RTOMs
        // (fail-closed to an empty list when no RTOMs resolve). Admins see all.
        const invoiceScopeWhere: Prisma.InvoiceWhereInput = filteredRtoms !== null
            ? { rtomArea: { in: filteredRtoms } }
            : canFilterGlobally
                ? {}
                : { rtomArea: { in: [] } };

        const now = new Date();
        const firstDayOfMonth = startOfMonth(now);
        const lastDayOfMonth = endOfMonth(now);
        const firstDayOfYear = startOfYear(now);
        const lastDayOfYear = endOfYear(now);

        // YTD: received in current year
        const yearWhere: Prisma.ServiceOrderWhereInput = {
            receivedDate: { gte: firstDayOfYear, lte: lastDayOfYear }
        };

        const baseWhere: Prisma.ServiceOrderWhereInput = {
            ...whereClause,
            ...yearWhere
        };

        const financialCompletionWhere: Prisma.ServiceOrderWhereInput = {
            OR: [
                { sltsStatus: { in: [...SOD_FINANCIAL_COMPLETION_STATUSES] } },
                { status: { in: [...SOD_FINANCIAL_COMPLETION_STATUSES] } }
            ]
        };

        // Current month: received in current month
        const monthlyWhere: Prisma.ServiceOrderWhereInput = {
            ...whereClause,
            receivedDate: { gte: firstDayOfMonth, lte: lastDayOfMonth }
        };

        // YTD completed: for revenue/financial aggregates (revenue recognized on completion)
        const ytdCompletedWhere: Prisma.ServiceOrderWhereInput = {
            ...whereClause,
            completedDate: { gte: firstDayOfYear, lte: lastDayOfYear }
        };

        // Year-to-date summary (canonical date per status — no OR double-counting)
        const [ytdTotal, ytdCompleted, ytdReturned] = await Promise.all([
            prisma.serviceOrder.count({ where: { ...whereClause, receivedDate: { gte: firstDayOfYear, lte: lastDayOfYear } } }),
            prisma.serviceOrder.count({ where: { ...whereClause, ...financialCompletionWhere, completedDate: { gte: firstDayOfYear, lte: lastDayOfYear } } }),
            prisma.serviceOrder.count({ where: { ...whereClause, sltsStatus: 'RETURN', statusDate: { gte: firstDayOfYear, lte: lastDayOfYear } } }),
        ]);

        // RTOM table: "pending" is what is open right now; "completed" and "returned" are this year, so every column
        // uses the same period as the year-to-date cards (it used to mix all-time counts with a year-to-date revenue).
        const [rtomPendingRaw, ytdRtomRevenueRaw, rtomReturnedRaw] = await Promise.all([
            prisma.serviceOrder.groupBy({
                by: ['opmcId'],
                where: { AND: [whereClause, { NOT: financialCompletionWhere }, { sltsStatus: { not: 'RETURN' } }] },
                _count: { _all: true },
            }),
            prisma.serviceOrder.groupBy({
                by: ['opmcId'],
                where: { ...whereClause, ...financialCompletionWhere, completedDate: { gte: firstDayOfYear, lte: lastDayOfYear } },
                _count: { _all: true },
                _sum: { revenueAmount: true },
            }),
            prisma.serviceOrder.groupBy({
                by: ['opmcId'],
                where: { ...whereClause, sltsStatus: 'RETURN', statusDate: { gte: firstDayOfYear, lte: lastDayOfYear } },
                _count: { _all: true },
            }),
        ]);
        const rtomOpmcMap = new Map(allOpmcs.map(o => [o.id, o.rtom]));
        const ytdRtomRevenueMap = new Map<string, number>();
        ytdRtomRevenueRaw.forEach(g => {
            const rtom = rtomOpmcMap.get(g.opmcId || '');
            if (!rtom) return;
            ytdRtomRevenueMap.set(rtom, (ytdRtomRevenueMap.get(rtom) || 0) + Number(g._sum?.revenueAmount || 0));
        });

        const rtomStatsMap: Record<string, { rtom: string; pending: number; completed: number; returned: number; revenue: number }> = {};

        allOpmcs.forEach(o => {
            if (!filteredRtoms || filteredRtoms.includes(o.rtom)) {
                if (!rtomStatsMap[o.rtom]) {
                    rtomStatsMap[o.rtom] = { rtom: o.rtom, pending: 0, completed: 0, returned: 0, revenue: 0 };
                }
            }
        });

        for (const g of rtomPendingRaw) {
            const rtom = rtomOpmcMap.get(g.opmcId || '');
            if (rtom && rtomStatsMap[rtom]) rtomStatsMap[rtom].pending += g._count._all;
        }
        for (const g of ytdRtomRevenueRaw) {
            const rtom = rtomOpmcMap.get(g.opmcId || '');
            if (rtom && rtomStatsMap[rtom]) rtomStatsMap[rtom].completed += g._count._all;
        }
        for (const g of rtomReturnedRaw) {
            const rtom = rtomOpmcMap.get(g.opmcId || '');
            if (rtom && rtomStatsMap[rtom]) rtomStatsMap[rtom].returned += g._count._all;
        }

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
                prisma.serviceOrder.count({ where: { ...whereClause, ...financialCompletionWhere, completedDate: { gte: firstDayOfMonth, lte: lastDayOfMonth } } }),
                prisma.serviceOrder.count({ where: { ...whereClause, sltsStatus: 'INPROGRESS', receivedDate: { gte: firstDayOfMonth, lte: lastDayOfMonth } } }),
                prisma.serviceOrder.count({ where: { ...whereClause, sltsStatus: 'RETURN', statusDate: { gte: firstDayOfMonth, lte: lastDayOfMonth } } }),
            ]).then(([total, completed, pending, returned]) => [
                { sltsStatus: 'TOTAL', _count: { _all: total } },
                { sltsStatus: 'COMPLETED', _count: { _all: completed } },
                { sltsStatus: 'INPROGRESS', _count: { _all: pending } },
                { sltsStatus: 'RETURN', _count: { _all: returned } },
            ]),
            Promise.resolve([]),
            // Contractor performance: every order received this year per contractor, and how many of them are completed
            // by the one company-wide completion rule (it used to count only status COMPLETED, which missed most completions).
            canViewContractorPerformance ? Promise.all([
                prisma.serviceOrder.groupBy({ by: ['contractorId'], where: { ...baseWhere, contractorId: { not: null } }, _count: { _all: true } }),
                prisma.serviceOrder.groupBy({ by: ['contractorId'], where: { ...baseWhere, ...financialCompletionWhere, contractorId: { not: null } }, _count: { _all: true } }),
            ]) : Promise.resolve([[], []]),
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
        const [contractorTotals, contractorCompleted] = contractorPerfRaw as unknown as [ContractorRawStat[], ContractorRawStat[]];

        const allTimeSummary = {
            total: ytdTotal,
            completed: ytdCompleted,
            returned: ytdReturned,
            pending: broughtForward
        };

        // Order revenue and margin are finance figures: only callers with finance access receive them.
        const canSeeFinance = effectivePermissions.includes(RBAC_PERMISSIONS.FINANCE_READ);
        const activeInvoiceScope: Prisma.InvoiceWhereInput = { ...invoiceScopeWhere, status: { notIn: ['CANCELLED', 'REJECTED'] } };
        const [
            financialAggregates,
            slaBreachedCount,
            invoicedAggregates,
            pendingInvoiceAggregates,
            uninvoicedSodAggregates,
            patRejectedOpen,
            completedWithoutAmounts,
            agingNoDate,
        ] = await Promise.all([
            canSeeFinance ? prisma.serviceOrder.aggregate({
                where: { ...ytdCompletedWhere, ...financialCompletionWhere },
                _sum: {
                    revenueAmount: true,
                    contractorAmount: true
                }
            }) : Promise.resolve(null),
            prisma.serviceOrder.count({
                where: { ...whereClause, sltsStatus: 'INPROGRESS', receivedDate: { lt: subDays(now, 2) } }
            }),
            // Regional isolation: invoices are scoped by rtomArea. Cancelled and rejected invoices are not billing,
            // and the amount is the same field the Finance tab uses, so both tabs agree.
            canSeeFinance ? prisma.invoice.aggregate({ where: activeInvoiceScope, _sum: { amount: true } }).catch(() => ({ _sum: { amount: 0 } })) : Promise.resolve(null),
            canSeeFinance ? prisma.invoice.aggregate({ where: { ...activeInvoiceScope, status: 'PENDING' }, _count: { _all: true }, _sum: { amount: true } }).catch(() => ({ _count: { _all: 0 }, _sum: { amount: 0 } })) : Promise.resolve(null),
            // Same rule as the Finance tab's unbilled work: completed, with amounts, not invoiced.
            canSeeFinance ? prisma.serviceOrder.aggregate({
                where: { AND: [whereClause, financialCompletionWhere, { revenueAmount: { not: null } }, { contractorAmount: { not: null } }], invoiced: false, invoiceId: null },
                _sum: { revenueAmount: true },
            }).catch(() => ({ _sum: { revenueAmount: 0 } })) : Promise.resolve(null),
            // Orders that are rejected right now (the banner used to count every rejection event of the year, corrected ones included).
            prisma.serviceOrder.count({ where: { AND: [whereClause, { OR: [{ status: { in: ['PAT_REJECTED', 'PAT_OPMC_REJECTED'] } }, { sltsStatus: { in: ['PAT_REJECTED', 'PAT_OPMC_REJECTED'] } }] }] } }),
            canSeeFinance ? prisma.serviceOrder.count({ where: { AND: [ytdCompletedWhere, financialCompletionWhere, { OR: [{ revenueAmount: null }, { contractorAmount: null }] }] } }) : Promise.resolve(0),
            prisma.serviceOrder.count({ where: { ...whereClause, sltsStatus: 'INPROGRESS', receivedDate: null } }),
        ]);

        const totalRevenue = Number(financialAggregates?._sum.revenueAmount || 0);
        const totalContractorCost = Number(financialAggregates?._sum.contractorAmount || 0);
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
            financials: canSeeFinance ? {
                totalRevenue,
                totalContractorCost,
                netMargin,
                marginPercentage,
                /** completed orders this year that have no revenue or contractor amount, so the figures above are understated by them */
                missingAmountCount: completedWithoutAmounts,
            } : undefined,
            financeSummary: canSeeFinance ? {
                invoicedTotal: Number(invoicedAggregates?._sum.amount || 0),
                pendingInvoices: Number(pendingInvoiceAggregates?._count._all || 0),
                pendingInvoiceAmount: Number(pendingInvoiceAggregates?._sum.amount || 0),
                uninvoicedCompletedAmount: Number(uninvoicedSodAggregates?._sum.revenueAmount || 0)
            } : undefined,
            sla: {
                slaBreachedCount,
            },
            statusBreakdown: [] as { status: string; count: number }[],
            pat: {
                passed: sltPatResults.filter(s => s.status === 'PAT_PASSED').reduce((acc, curr) => acc + (curr._count?._all || 0), 0),
                /** rejection events this year (corrected ones included); the chart uses it next to "passed" */
                rejected: sltPatResults.filter(s => s.status === 'PAT_REJECTED' || s.status === 'REJECTED' || s.status === 'PAT_OPMC_REJECTED' || s.status === 'OPMC_REJECTED').reduce((acc, curr) => acc + (curr._count?._all || 0), 0),
                /** orders that are rejected right now and still need review: used by the alert banner and the rejected card */
                rejectedOpen: patRejectedOpen,
                pending: await prisma.serviceOrder.count({ where: { ...whereClause, ...financialCompletionWhere, hoPatStatus: 'PENDING' } }),
            },
            contractors: [] as ContractorStat[],
            rtoms: [] as RtomStat[],
            aging: [
                { range: '0-3 Days', count: agingRaw[0] },
                { range: '3-5 Days', count: agingRaw[1] },
                { range: '5-7 Days', count: agingRaw[2] },
                { range: '7-10 Days', count: agingRaw[3] },
                { range: '10+ Days', count: agingRaw[4] },
                ...(agingNoDate > 0 ? [{ range: 'No received date', count: agingNoDate }] : []),
            ]
        };

        const statusBreakdownRaw = await prisma.serviceOrder.groupBy({
            by: ['status'],
            where: { ...whereClause, ...financialCompletionWhere, completedDate: { gte: firstDayOfMonth, lte: lastDayOfMonth } },
            _count: { _all: true }
        });

        stats.statusBreakdown = (statusBreakdownRaw as unknown as { status: string; _count: { _all: number } }[]).map((s) => ({
            status: s.status,
            count: s._count?._all || 0
        })).sort((a, b) => b.count - a.count);

        const contractorIds = [...new Set(contractorTotals.map((c) => c.contractorId))].filter(Boolean) as string[];
        const contractorsData = await prisma.contractor.findMany({
            where: { id: { in: contractorIds } },
            select: { id: true, name: true }
        });

        contractorIds.forEach(cId => {
            const cName = contractorsData.find(c => c.id === cId)?.name || 'Unknown';
            const completed = contractorCompleted.find((p) => p.contractorId === cId)?._count?._all || 0;
            const total = contractorTotals.find((p) => p.contractorId === cId)?._count?._all || 0;
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
                revenue: ytdRtomRevenueMap.get(r.rtom) || 0,
                patPassed: sltPatResults.filter((s) => s.rtom === r.rtom && s.status === 'PAT_PASSED').reduce((acc, curr) => acc + (curr._count?._all || 0), 0),
                patRejected: sltPatResults.filter((s) => s.rtom === r.rtom && (s.status === 'OPMC_REJECTED' || s.status === 'REJECTED' || s.status === 'PAT_OPMC_REJECTED') && (s.source === 'OPMC_REJECTED' || s.source === 'SYNC')).reduce((acc, curr) => acc + (curr._count?._all || 0), 0),
                sltsPatRejected: sltPatResults.filter((s) => s.rtom === r.rtom && (s.status === 'PAT_REJECTED' || s.status === 'REJECTED') && s.source === 'HO_REJECTED').reduce((acc, curr) => acc + (curr._count?._all || 0), 0),
            });
        });

        const resultData = {
            ...stats,
            updatedAt: new Date().toISOString(),
            availableRegions,
            rtomRegionMap,
            userRole: user.role,
            userAccessibleRtoms: user.accessibleOpmcs.map((o: { rtom: string }) => o.rtom)
        };
        
        return resultData;
        })(); // Execute the async closure immediately

        STATS_CACHE.set(cacheKey, { promise: fetchPromise, expiresAt: Date.now() + CACHE_TTL_MS });

        fetchPromise.catch(() => {
            STATS_CACHE.delete(cacheKey); // Remove failed promises so next request retries
        });

        return fetchPromise;
    }
}
