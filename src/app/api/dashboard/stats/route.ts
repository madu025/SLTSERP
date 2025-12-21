import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { startOfMonth, endOfMonth, subMonths } from 'date-fns';

export async function GET(request: Request) {
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
        const isManager = user.role === 'MANAGER' || user.role === 'SA_MANAGER';
        const isAreaManager = user.role === 'AREA_MANAGER';
        const isAreaCoordinator = user.role === 'AREA_COORDINATOR';

        // Base where clause based on accessible OPMCs
        let whereClause: any = {};
        if (!isAdmin && !isManager) {
            const accessibleOpmcIds = user.accessibleOpmcs.map(o => o.id);
            whereClause.opmcId = { in: accessibleOpmcIds };
        }

        const now = new Date();
        const firstDayOfMonth = startOfMonth(now);
        const lastDayOfMonth = endOfMonth(now);

        // 1. Monthly Stats
        const monthlyStats = await (prisma.serviceOrder as any).groupBy({
            by: ['sltsStatus'],
            where: {
                ...whereClause,
                createdAt: {
                    gte: firstDayOfMonth,
                    lte: lastDayOfMonth
                }
            },
            _count: {
                _all: true
            }
        });

        // 2. Total Stats
        const totalStats = await (prisma.serviceOrder as any).groupBy({
            by: ['sltsStatus'],
            where: whereClause,
            _count: {
                _all: true
            }
        });

        // 3. PAT Stats
        const patStats = await (prisma.serviceOrder as any).groupBy({
            by: ['patStatus'],
            where: {
                ...whereClause,
                patStatus: { not: null }
            },
            _count: {
                _all: true
            }
        });

        // 4. Contractor Performance (Top 5)
        const contractorPerf = await (prisma.serviceOrder as any).groupBy({
            by: ['contractorId', 'sltsStatus'],
            where: {
                ...whereClause,
                contractorId: { not: null }
            },
            _count: {
                _all: true
            }
        });

        // 5. RTOM Performance (for Manager/Area Manager)
        const rtomStats = await (prisma.serviceOrder as any).groupBy({
            by: ['rtom', 'sltsStatus'],
            where: whereClause,
            _count: {
                _all: true
            }
        });

        // Process data for the response
        const stats = {
            monthly: {
                total: (monthlyStats as any[]).reduce((acc, curr) => acc + (curr._count?._all || 0), 0),
                completed: (monthlyStats as any[]).find(s => s.sltsStatus === 'COMPLETED')?._count?._all || 0,
                pending: (monthlyStats as any[]).find(s => s.sltsStatus === 'INPROGRESS')?._count?._all || 0,
                returned: (monthlyStats as any[]).find(s => s.sltsStatus === 'RETURN')?._count?._all || 0,
            },
            allTime: {
                total: (totalStats as any[]).reduce((acc, curr) => acc + (curr._count?._all || 0), 0),
                completed: (totalStats as any[]).find(s => s.sltsStatus === 'COMPLETED')?._count?._all || 0,
                returned: (totalStats as any[]).find(s => s.sltsStatus === 'RETURN')?._count?._all || 0,
                pending: (totalStats as any[]).find(s => s.sltsStatus === 'INPROGRESS')?._count?._all || 0,
            },
            pat: {
                passed: (patStats as any[]).find(s => s.patStatus === 'PASS')?._count?._all || 0,
                rejected: (patStats as any[]).find(s => s.patStatus === 'REJECTED')?._count?._all || 0,
                pending: (patStats as any[]).find(s => s.patStatus === 'PENDING')?._count?._all || 0,
            },
            contractors: [] as any[],
            rtoms: [] as any[]
        };

        // Format Contractors
        const contractorIds = [...new Set((contractorPerf as any[]).map(c => c.contractorId))].filter(Boolean) as string[];
        const contractorsData = await prisma.contractor.findMany({
            where: { id: { in: contractorIds } },
            select: { id: true, name: true }
        });

        contractorIds.forEach(cId => {
            const cName = contractorsData.find(c => c.id === cId)?.name || 'Unknown';
            const completed = (contractorPerf as any[]).find(p => p.contractorId === cId && p.sltsStatus === 'COMPLETED')?._count?._all || 0;
            const total = (contractorPerf as any[]).filter(p => p.contractorId === cId).reduce((acc, curr) => acc + (curr._count?._all || 0), 0);
            stats.contractors.push({
                name: cName,
                completed,
                total,
                percentage: total > 0 ? Math.round((completed / total) * 100) : 0
            });
        });

        // Format RTOMs
        const rtomNames = [...new Set((rtomStats as any[]).map(r => r.rtom))];
        rtomNames.forEach(name => {
            const completed = (rtomStats as any[]).find(r => r.rtom === name && r.sltsStatus === 'COMPLETED')?._count?._all || 0;
            const pending = (rtomStats as any[]).find(r => r.rtom === name && r.sltsStatus === 'INPROGRESS')?._count?._all || 0;
            const returned = (rtomStats as any[]).find(r => r.rtom === name && r.sltsStatus === 'RETURN')?._count?._all || 0;
            const rtomTotal = (rtomStats as any[]).filter(r => r.rtom === name).reduce((acc, curr) => acc + (curr._count?._all || 0), 0);

            stats.rtoms.push({
                name,
                completed,
                pending,
                returned,
                total: rtomTotal
            });
        });

        return NextResponse.json(stats);
    } catch (error) {
        console.error('Dashboard stats error:', error);
        return NextResponse.json({ message: 'Error fetching stats' }, { status: 500 });
    }
}
