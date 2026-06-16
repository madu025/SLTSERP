import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { startOfMonth, endOfMonth, subMonths, subDays, subYears, format } from 'date-fns';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const view = searchParams.get('view') || 'manager';
        const period = searchParams.get('period') || '6M';
        const customFrom = searchParams.get('from');
        const customTo = searchParams.get('to');

        // Calculate date range based on period
        let startDate: Date;
        let endDate = new Date();
        let monthsToShow = 6;

        if (customFrom && customTo) {
            // Custom date range
            startDate = new Date(customFrom);
            endDate = new Date(customTo);
            const monthsDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30));
            monthsToShow = Math.min(monthsDiff, 12);
        } else {
            // Predefined periods
            switch (period) {
                case 'Daily':
                    startDate = subDays(endDate, 1);
                    monthsToShow = 1;
                    break;
                case 'Weekly':
                    startDate = subDays(endDate, 7);
                    monthsToShow = 1;
                    break;
                case '1M':
                    startDate = subMonths(endDate, 1);
                    monthsToShow = 1;
                    break;
                case '3M':
                    startDate = subMonths(endDate, 3);
                    monthsToShow = 3;
                    break;
                case '6M':
                    startDate = subMonths(endDate, 6);
                    monthsToShow = 6;
                    break;
                case '1Y':
                    startDate = subYears(endDate, 1);
                    monthsToShow = 12;
                    break;
                default:
                    startDate = subMonths(endDate, 6);
                    monthsToShow = 6;
            }
        }

        // 1. MANAGER VIEW - Executive Overview
        if (view === 'manager') {

            // A. Monthly Trend
            const trendDataRaw = await prisma.serviceOrder.groupBy({
                by: ['completedDate'],
                where: {
                    sltsStatus: 'COMPLETED',
                    completedDate: {
                        gte: startDate,
                        lte: endDate
                    }
                },
                _count: { _all: true }
            });

            // Process trend data into monthly buckets
            const trendMap = new Map();
            // Initialize months based on period
            for (let i = monthsToShow - 1; i >= 0; i--) {
                const d = subMonths(endDate, i);
                const k = format(d, 'MMM');
                trendMap.set(k, 0);
            }

            trendDataRaw.forEach(item => {
                if (item.completedDate) {
                    const k = format(item.completedDate, 'MMM');
                    if (trendMap.has(k)) {
                        trendMap.set(k, trendMap.get(k) + item._count._all);
                    }
                }
            });

            const monthlyTrend = Array.from(trendMap.entries()).map(([month, completed]) => ({
                month,
                completed,
                target: 150 // Mock target, ideally from DB
            }));

            // B. Contractor Performance (filtered by date range)
            const contractorStats = await prisma.serviceOrder.groupBy({
                by: ['contractorId', 'sltsStatus'],
                where: {
                    contractorId: { not: null },
                    createdAt: {
                        gte: startDate,
                        lte: endDate
                    }
                },
                _count: { _all: true }
            });

            const contractorIds = [...new Set(contractorStats.map(s => s.contractorId))].filter(Boolean) as string[];
            const contractors = await prisma.contractor.findMany({
                where: { id: { in: contractorIds } },
                select: { id: true, name: true }
            });

            const contractorPerformance = contractors.map(c => {
                const stats = contractorStats.filter(s => s.contractorId === c.id);
                const completed = stats.find(s => s.sltsStatus === 'COMPLETED')?._count._all || 0;
                const pending = stats.find(s => s.sltsStatus === 'INPROGRESS')?._count._all || 0;
                const returned = stats.find(s => s.sltsStatus === 'RETURN')?._count._all || 0;
                const total = completed + pending + returned;

                return {
                    name: c.name,
                    completed,
                    pending,
                    returned,
                    efficiency: total > 0 ? Math.round((completed / total) * 100) : 0
                };
            }).sort((a, b) => b.completed - a.completed).slice(0, 10); // Top 10

            // C. RTOM Performance (filtered by date range)
            const rtomStats = await prisma.serviceOrder.groupBy({
                by: ['rtom', 'sltsStatus'],
                where: {
                    createdAt: {
                        gte: startDate,
                        lte: endDate
                    }
                },
                _count: { _all: true }
            });

            const rtomNames = [...new Set(rtomStats.map(s => s.rtom))].filter(Boolean);
            const rtomPerformance = rtomNames.map(rtom => {
                const stats = rtomStats.filter(s => s.rtom === rtom);
                const completed = stats.find(s => s.sltsStatus === 'COMPLETED')?._count._all || 0;
                const total = stats.reduce((acc, curr) => acc + curr._count._all, 0);
                return {
                    name: rtom,
                    completion: total > 0 ? Math.round((completed / total) * 100) : 0,
                    pending: total - completed
                };
            }).sort((a, b) => b.completion - a.completion);

            return NextResponse.json({
                monthlyTrend,
                contractorPerformance,
                rtomPerformance,
                summary: {
                    totalCompletion: monthlyTrend.reduce((acc, curr) => acc + curr.completed, 0),
                    activeContractors: contractors.length
                },
                dateRange: {
                    from: startDate,
                    to: endDate,
                    period
                }
            });
        }

        // 2. AREA MANAGER VIEW - Regional/ARM/RTOM/Coordinator Performance
        if (view === 'area') {
            const groupBy = searchParams.get('groupBy') || 'RTOM';

            // Fetch service orders within date range
            const orders = await prisma.serviceOrder.findMany({
                where: {
                    createdAt: {
                        gte: startDate,
                        lte: endDate
                    }
                },
                include: {
                    opmc: true,
                    team: {
                        include: {
                            members: true
                        }
                    }
                }
            });

            // Group data based on selection
            const groupMap = new Map<string, { completed: number, pending: number, returned: number }>();

            orders.forEach(order => {
                let groupKey = '';

                switch (groupBy) {
                    case 'REGION':
                        groupKey = order.opmc?.region || 'Unknown';
                        break;
                    case 'ARM':
                        // Assuming ARM info is stored in OPMC or can be derived
                        groupKey = order.opmc?.province || 'Unknown ARM';
                        break;
                    case 'RTOM':
                        groupKey = order.rtom || 'Unknown';
                        break;
                    case 'COORDINATOR':
                        // Area Coordinator - would need to be linked in schema
                        groupKey = order.team?.name || 'Unassigned';
                        break;
                    default:
                        groupKey = order.rtom || 'Unknown';
                }

                if (!groupMap.has(groupKey)) {
                    groupMap.set(groupKey, { completed: 0, pending: 0, returned: 0 });
                }

                const stats = groupMap.get(groupKey)!;
                if (order.sltsStatus === 'COMPLETED') stats.completed++;
                else if (order.sltsStatus === 'INPROGRESS') stats.pending++;
                else if (order.sltsStatus === 'RETURN') stats.returned++;
            });

            const performanceData = Array.from(groupMap.entries()).map(([name, stats]) => ({
                name,
                ...stats
            })).sort((a, b) => b.completed - a.completed);

            // Trend data (monthly breakdown)
            const trendMap = new Map();
            for (let i = monthsToShow - 1; i >= 0; i--) {
                const d = subMonths(endDate, i);
                const k = format(d, 'MMM');
                trendMap.set(k, { completed: 0, pending: 0 });
            }

            orders.forEach(order => {
                if (order.createdAt) {
                    const k = format(order.createdAt, 'MMM');
                    if (trendMap.has(k)) {
                        const trend = trendMap.get(k);
                        if (order.sltsStatus === 'COMPLETED') trend.completed++;
                        else if (order.sltsStatus === 'INPROGRESS') trend.pending++;
                    }
                }
            });

            const trendData = Array.from(trendMap.entries()).map(([month, data]) => ({
                month,
                ...data
            }));

            const summary = {
                total: orders.length,
                completed: orders.filter(o => o.sltsStatus === 'COMPLETED').length,
                pending: orders.filter(o => o.sltsStatus === 'INPROGRESS').length,
                returned: orders.filter(o => o.sltsStatus === 'RETURN').length
            };

            return NextResponse.json({
                performanceData,
                trendData,
                summary,
                dateRange: {
                    from: startDate,
                    to: endDate,
                    period
                },
                groupBy
            });
        }

        return NextResponse.json({ error: 'Invalid view type' }, { status: 400 });

    } catch (error) {
        console.error('Analytics Error:', error);
        return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
    }
}
