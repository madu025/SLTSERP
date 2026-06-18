import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { formatDistanceToNow } from 'date-fns';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const userId = request.headers.get('x-user-id');
        const userRole = request.headers.get('x-user-role');

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const isAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';

        // 1. Determine OPMC Boundaries
        let accessibleOpmcIds: string[] = [];
        if (!isAdmin) {
            const dbUser = await prisma.user.findUnique({
                where: { id: userId },
                include: { accessibleOpmcs: true }
            });
            if (dbUser) {
                accessibleOpmcIds = dbUser.accessibleOpmcs.map(o => o.id);
            }
        }

        const projectWhere: any = {};
        if (!isAdmin && accessibleOpmcIds.length > 0) {
            projectWhere.opmcId = { in: accessibleOpmcIds };
        }

        // Collect accessible project IDs
        const accessibleProjects = await prisma.project.findMany({
            where: projectWhere,
            select: { id: true }
        });
        const projectIds = accessibleProjects.map(p => p.id);

        // =====================================================
        // FINANCIALS DASHBOARD
        // =====================================================
        // Total Budget & Actual Spend
        const budgetAgg = await prisma.project.aggregate({
            where: projectWhere,
            _sum: { budget: true, actualCost: true }
        });
        const totalBudget = budgetAgg._sum.budget || 0;
        const totalActualSpend = budgetAgg._sum.actualCost || 0;

        // Total Invoiced (from ProjectInvoice)
        const invoiceAgg = await prisma.projectInvoice.aggregate({
            where: { projectId: { in: projectIds } },
            _sum: { totalAmount: true, paidAmount: true, balanceAmount: true }
        });
        const totalInvoiced = invoiceAgg._sum.totalAmount || 0;
        const totalPaid = invoiceAgg._sum.paidAmount || 0;
        const totalOutstanding = invoiceAgg._sum.balanceAmount || 0;

        // Payment Voucher Status Breakdown
        const voucherCounts = await prisma.paymentVoucher.groupBy({
            by: ['status'],
            where: { projectId: { in: projectIds } },
            _count: { _all: true }
        });
        interface VoucherStatusEntry { label: string; count: number; color: string; width: string }
        const totalVouchers = voucherCounts.reduce((sum, v) => sum + v._count._all, 0) || 1;
        const voucherStatusMap: Record<string, { label: string; color: string }> = {
            PAID: { label: 'Paid', color: 'bg-emerald-500' },
            PENDING: { label: 'Pending', color: 'bg-amber-500' },
            OVERDUE: { label: 'Overdue', color: 'bg-rose-500' },
            DRAFT: { label: 'Draft', color: 'bg-slate-400' },
        };
        const paymentStatus: VoucherStatusEntry[] = voucherCounts.map(v => {
            const meta = voucherStatusMap[v.status] || { label: v.status, color: 'bg-slate-400' };
            const pct = Math.round((v._count._all / totalVouchers) * 100);
            return {
                label: meta.label,
                count: v._count._all,
                color: meta.color,
                width: `${pct}%`
            };
        });
        if (paymentStatus.length === 0) {
            paymentStatus.push(
                { label: 'Paid', count: 0, color: 'bg-emerald-500', width: '0%' },
                { label: 'Pending', count: 0, color: 'bg-amber-500', width: '0%' },
                { label: 'Overdue', count: 0, color: 'bg-rose-500', width: '0%' },
                { label: 'Draft', count: 0, color: 'bg-slate-400', width: '0%' }
            );
        }

        // Top Expenses by Type (from ProjectExpense)
        const expenseTypeCounts = await prisma.projectExpense.groupBy({
            by: ['type'],
            where: { projectId: { in: projectIds } },
            _sum: { amount: true }
        });
        const expensesByType = expenseTypeCounts as unknown as { type: string; _sum: { amount: number | null } }[];
        const totalExpenseAmount = expensesByType.reduce((sum, e) => sum + (e._sum.amount || 0), 0) || 1;
        const categoryColors = ['bg-blue-500', 'bg-indigo-500', 'bg-violet-500', 'bg-emerald-500', 'bg-amber-500', 'bg-slate-400'];
        const topExpenses = expensesByType
            .map((e, i) => ({
                category: e.type || 'Uncategorized',
                amount: e._sum.amount || 0,
                percentage: Math.round(((e._sum.amount || 0) / totalExpenseAmount) * 100),
                color: categoryColors[i % categoryColors.length]
            }))
            .sort((a, b) => b.amount - a.amount)
            .slice(0, 6);

        // Recent Transactions (combined invoices + payment vouchers)
        interface Transaction {
            date: string;
            desc: string;
            type: string;
            amount: number;
            status: string;
        }
        const recentInvoices = await prisma.projectInvoice.findMany({
            where: { projectId: { in: projectIds } },
            take: 3,
            orderBy: { invoiceDate: 'desc' },
            select: { invoiceDate: true, invoiceNumber: true, totalAmount: true, status: true }
        });
        const recentPayments = await prisma.paymentVoucher.findMany({
            where: { projectId: { in: projectIds } },
            take: 3,
            orderBy: { paymentDate: 'desc' },
            select: { paymentDate: true, pvNumber: true, amount: true, status: true, title: true }
        });
        const recentTransactions: Transaction[] = [
            ...recentInvoices.map(i => ({
                date: i.invoiceDate ? new Date(i.invoiceDate).toISOString().split('T')[0] : '',
                desc: `Invoice ${i.invoiceNumber}`,
                type: 'Invoice',
                amount: i.totalAmount,
                status: i.status
            })),
            ...recentPayments.map(p => ({
                date: p.paymentDate ? new Date(p.paymentDate).toISOString().split('T')[0] : '',
                desc: p.title || `PV ${p.pvNumber}`,
                type: 'Payment',
                amount: p.amount,
                status: p.status
            }))
        ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);

        // =====================================================
        // LOGISTICS & WAREHOUSE DASHBOARD
        // =====================================================
        // Total Items across inventory
        const totalItems = await prisma.inventoryStock.count();

        // Low Stock Items (quantity <= minLevel)
        // Prisma cannot compare two columns inline; use $queryRaw for precision
        const lowStockRaw: any[] = await prisma.$queryRaw`
            SELECT s."quantity", s."minLevel", i."name", i."unit"
            FROM "InventoryStock" s
            JOIN "InventoryItem" i ON i."id" = s."itemId"
            WHERE s."quantity" <= s."minLevel"
            LIMIT 5
        `;
        const lowStockCountRaw: any[] = await prisma.$queryRaw`
            SELECT COUNT(*)::int AS count
            FROM "InventoryStock" s
            WHERE s."quantity" <= s."minLevel"
        `;
        const lowStockCount = lowStockCountRaw[0]?.count || 0;
        // Low Stock Alerts (top 5)
        const lowStockAlerts = lowStockRaw.map((s: any) => ({
            item: s.name || 'Unknown',
            current: s.quantity || 0,
            min: s.minLevel || 0,
            unit: s.unit || 'pcs'
        }));

        // Pending GRNs
        const pendingGRNs = await prisma.projectGoodsReceipt.count({
            where: { projectId: { in: projectIds }, status: 'PENDING' }
        });

        // Active Stock Issues
        const activeStockIssues = await prisma.stockIssue.count({
            where: { projectId: { in: projectIds }, status: { in: ['PENDING', 'ISSUED'] } }
        });

        // Recent Stock Movements (from StockIssue + GRN)
        interface StockMovement {
            date: string;
            item: string;
            type: string;
            qty: number;
            ref: string;
            status: string;
        }
        const recentIssues = await prisma.stockIssue.findMany({
            where: { projectId: { in: projectIds } },
            take: 3,
            orderBy: { createdAt: 'desc' },
            include: {
                items: {
                    take: 1,
                    include: { item: { select: { name: true } } }
                }
            }
        });
        const recentGRNs = await prisma.projectGoodsReceipt.findMany({
            where: { projectId: { in: projectIds } },
            take: 3,
            orderBy: { createdAt: 'desc' },
            include: {
                items: {
                    take: 1
                }
            }
        });
        const stockMovements: StockMovement[] = [
            ...recentIssues.map(si => ({
                date: si.createdAt ? new Date(si.createdAt).toISOString().split('T')[0] : '',
                item: si.items[0]?.item?.name || 'Unknown',
                type: 'Issue',
                qty: si.items[0]?.quantity || 0,
                ref: si.issueNumber || '',
                status: si.status
            })),
            ...recentGRNs.map(g => ({
                date: g.createdAt ? new Date(g.createdAt).toISOString().split('T')[0] : '',
                item: g.items[0]?.description || 'Unknown',
                type: 'GRN',
                qty: g.items[0]?.quantityReceived || 0,
                ref: g.grnNumber || '',
                status: g.status
            }))
        ].sort((a, b) => b.date.localeCompare(a.date));

        // =====================================================
        // QA/QC DASHBOARD
        // =====================================================
        // Model: ProjectInspection { status: PENDING|PASSED|FAILED|UNDER_CORRECTION, category: INSPECTION_REQUEST|NON_CONFORMANCE }
        const inspectionAgg = await prisma.projectInspection.groupBy({
            by: ['status'],
            where: { projectId: { in: projectIds } },
            _count: { _all: true }
        }) as unknown as { status: string; _count: { _all: number } }[];
        const totalInspections = inspectionAgg.reduce((sum, i) => sum + i._count._all, 0);
        const passedInspections = inspectionAgg.find(i => i.status === 'PASSED')?._count._all || 0;
        const failedInspections = inspectionAgg.find(i => i.status === 'FAILED')?._count._all || 0;
        const passRate = totalInspections > 0 ? +(passedInspections / totalInspections * 100).toFixed(1) : 0;

        // Open NCRs (inspections with category NON_CONFORMANCE and status not PASSED)
        const openNCRs = await prisma.projectInspection.count({
            where: { projectId: { in: projectIds }, category: 'NON_CONFORMANCE', status: { not: 'PASSED' } }
        });

        // Pending Reviews
        const pendingReviews = await prisma.projectInspection.count({
            where: { projectId: { in: projectIds }, status: 'PENDING' }
        });

        // Recent Inspections
        const recentInspectionsRaw = await prisma.projectInspection.findMany({
            where: { projectId: { in: projectIds } },
            take: 5,
            orderBy: { inspectedAt: 'desc' },
            include: {
                project: { select: { name: true } }
            }
        });
        const recentInspections = recentInspectionsRaw.map(ins => ({
            date: ins.inspectedAt ? new Date(ins.inspectedAt).toISOString().split('T')[0] : '',
            project: ins.project?.name || 'Unknown',
            inspector: ins.inspectorId || 'N/A',
            result: ins.status === 'PASSED' ? 'Pass' : ins.status === 'FAILED' ? 'Fail' : ins.status,
            notes: ins.correctiveAction || ''
        }));

        // Quality Trend (last 5 months)
        const trendMonths: { month: string; passRate: number; inspections: number }[] = [];
        const now = new Date();
        for (let i = 4; i >= 0; i--) {
            const startOfMonth = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const endOfMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
            const monthInspections = await prisma.projectInspection.count({
                where: {
                    projectId: { in: projectIds },
                    inspectedAt: { gte: startOfMonth, lte: endOfMonth }
                }
            });
            const monthPassed = await prisma.projectInspection.count({
                where: {
                    projectId: { in: projectIds },
                    status: 'PASSED',
                    inspectedAt: { gte: startOfMonth, lte: endOfMonth }
                }
            });
            const monthPassRate = monthInspections > 0 ? +(monthPassed / monthInspections * 100).toFixed(1) : 0;
            trendMonths.push({
                month: startOfMonth.toLocaleString('default', { month: 'short' }),
                passRate: monthPassRate,
                inspections: monthInspections
            });
        }

        // =====================================================
        // RESPONSE
        // =====================================================
        return NextResponse.json({
            financials: {
                totalBudget,
                totalInvoiced,
                totalPaid,
                totalOutstanding,
                topExpenses,
                paymentStatus,
                recentTransactions
            },
            logistics: {
                totalItems,
                lowStockCount,
                pendingGRNs,
                activeStockIssues,
                stockMovements,
                lowStockAlerts
            },
            qaqc: {
                totalInspections,
                passedInspections,
                failedInspections,
                passRate,
                openNCRs,
                pendingReviews,
                recentInspections,
                qualityTrend: trendMonths
            }
        });

    } catch (error) {
        console.error('Project Stats Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}