import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { handleApiError } from '@/lib/api-utils';

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
        const isManager = user.role === 'MANAGER' || user.role === 'SA_MANAGER' || user.role === 'OSP_MANAGER';
        // Area Manager & Coordinator logic is handled by the else block below

        // Base where clause based on accessible OPMCs
        let whereClause: any = {};
        if (!isAdmin && !isManager) {
            // Filter for Area Managers, Coordinators, QC Officers etc.
            const accessibleOpmcIds = user.accessibleOpmcs.map((o: any) => o.id);
            // If no assigned OPMCs, they see nothing (or user should be assigned OPMCs)
            whereClause.opmcId = { in: accessibleOpmcIds };
        }

        const now = new Date(); // 2026-xx-xx
        const firstDayOfMonth = startOfMonth(now);
        const lastDayOfMonth = endOfMonth(now);
        const firstDayOfYear = startOfYear(now);
        const lastDayOfYear = endOfYear(now);

        // Add Year Filter to Base Where Clause (All data restricted to 2026)
        whereClause.createdAt = {
            gte: firstDayOfYear,
            lte: lastDayOfYear
        };

        // Parallel Execution for all major stat blocks
        const [monthlyStats, totalStats, patStats, contractorPerf, rtomStats] = await Promise.all([
            // 1. Monthly Stats (Current Month)
            (prisma.serviceOrder as any).groupBy({
                by: ['sltsStatus'],
                where: { ...whereClause, createdAt: { gte: firstDayOfMonth, lte: lastDayOfMonth } },
                _count: { _all: true }
            }),
            // 2. Total Stats (Yearly Default)
            (prisma.serviceOrder as any).groupBy({
                by: ['sltsStatus'],
                where: whereClause,
                _count: { _all: true }
            }),
            // 3. PAT Stats
            (prisma.serviceOrder as any).groupBy({
                by: ['patStatus'],
                where: { ...whereClause, patStatus: { not: null } },
                _count: { _all: true }
            }),
            // 4. Contractor Performance (Only if Management)
            (isAdmin || isManager) ? (prisma.serviceOrder as any).groupBy({
                by: ['contractorId', 'sltsStatus'],
                where: { ...whereClause, contractorId: { not: null } },
                _count: { _all: true }
            }) : Promise.resolve([]),
            // 5. RTOM Performance (Only if Management)
            (isAdmin || isManager) ? (prisma.serviceOrder as any).groupBy({
                by: ['rtom', 'sltsStatus'],
                where: whereClause,
                _count: { _all: true }
            }) : Promise.resolve([])
        ]);

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
        return handleApiError(error);
    }
}
