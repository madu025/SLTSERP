import { prisma } from '@/lib/prisma';
import { formatDistanceToNow } from 'date-fns';
import { Prisma } from '@prisma/client';

export class ProjectDashboardService {
    
    // Internal helper to get accessible project IDs based on role
    private static async getAccessibleProjectIds(userId: string, userRole: string): Promise<string[]> {
        const isAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';
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

        const projectWhere: Prisma.ProjectWhereInput = {};
        if (!isAdmin && accessibleOpmcIds.length > 0) {
            projectWhere.opmcId = { in: accessibleOpmcIds };
        }

        const accessibleProjects = await prisma.project.findMany({
            where: projectWhere,
            select: { id: true }
        });

        return accessibleProjects.map(p => p.id);
    }

    static async getProjectStats(userId: string, userRole: string) {
        const isAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';
        const projectIds = await this.getAccessibleProjectIds(userId, userRole);

        const projectWhere: Prisma.ProjectWhereInput = {};
        if (!isAdmin && projectIds.length > 0) {
            projectWhere.id = { in: projectIds };
        }

        // =====================================================
        // FINANCIALS DASHBOARD
        // =====================================================
        const budgetAgg = await prisma.project.aggregate({
            where: projectWhere,
            _sum: { budget: true, actualCost: true }
        });
        const totalBudget = budgetAgg._sum.budget || 0;

        const invoiceAgg = await prisma.projectInvoice.aggregate({
            where: { projectId: { in: projectIds } },
            _sum: { totalAmount: true, paidAmount: true, balanceAmount: true }
        });
        const totalInvoiced = invoiceAgg._sum.totalAmount || 0;
        const totalPaid = invoiceAgg._sum.paidAmount || 0;
        const totalOutstanding = invoiceAgg._sum.balanceAmount || 0;

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
        const totalItems = await prisma.inventoryStock.count();
        const lowStockRaw: { quantity: number, minLevel: number, name: string, unit: string }[] = await prisma.$queryRaw`
            SELECT s."quantity", s."minLevel", i."name", i."unit"
            FROM "InventoryStock" s
            JOIN "InventoryItem" i ON i."id" = s."itemId"
            WHERE s."quantity" <= s."minLevel"
            LIMIT 5
        `;
        const lowStockCountRaw: { count: number }[] = await prisma.$queryRaw`
            SELECT COUNT(*)::int AS count
            FROM "InventoryStock" s
            WHERE s."quantity" <= s."minLevel"
        `;
        const lowStockCount = lowStockCountRaw[0]?.count || 0;
        const lowStockAlerts = lowStockRaw.map((s) => ({
            item: s.name || 'Unknown',
            current: s.quantity || 0,
            min: s.minLevel || 0,
            unit: s.unit || 'pcs'
        }));

        const pendingGRNs = await prisma.projectGoodsReceipt.count({
            where: { projectId: { in: projectIds }, status: 'PENDING' }
        });

        const activeStockIssues = await prisma.stockIssue.count({
            where: { projectId: { in: projectIds }, status: { in: ['PENDING', 'ISSUED'] } }
        });

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
        const inspectionAgg = await prisma.projectInspection.groupBy({
            by: ['status'],
            where: { projectId: { in: projectIds } },
            _count: { _all: true }
        }) as unknown as { status: string; _count: { _all: number } }[];
        const totalInspections = inspectionAgg.reduce((sum, i) => sum + i._count._all, 0);
        const passedInspections = inspectionAgg.find(i => i.status === 'PASSED')?._count._all || 0;
        const failedInspections = inspectionAgg.find(i => i.status === 'FAILED')?._count._all || 0;
        const passRate = totalInspections > 0 ? +(passedInspections / totalInspections * 100).toFixed(1) : 0;

        const openNCRs = await prisma.projectInspection.count({
            where: { projectId: { in: projectIds }, category: 'NON_CONFORMANCE', status: { not: 'PASSED' } }
        });

        const pendingReviews = await prisma.projectInspection.count({
            where: { projectId: { in: projectIds }, status: 'PENDING' }
        });

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

        return {
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
        };
    }

    static async getProjectOverview(userId: string, userRole: string) {
        const isAdmin = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';
        const projectIds = await this.getAccessibleProjectIds(userId, userRole);
        
        const projectWhere: Prisma.ProjectWhereInput = {};
        if (!isAdmin && projectIds.length > 0) {
            projectWhere.id = { in: projectIds };
        }

        const now = new Date();

        const allProjects = await prisma.project.findMany({
            where: projectWhere,
            include: {
                opmc: true
            }
        });

        const activeProjectsList = allProjects.filter(p => p.status !== 'COMPLETED' && p.status !== 'CANCELLED');
        const activeProjectsCount = activeProjectsList.length;

        const totalBudget = allProjects.reduce((sum, p) => sum + (p.budget || 0), 0);
        const actualSpend = allProjects.reduce((sum, p) => sum + (p.actualCost || 0), 0);

        const delayedProjectsList = activeProjectsList.filter(p => {
            if (!p.endDate) return false;
            const end = new Date(p.endDate);
            return end < now;
        });
        const delayedCount = delayedProjectsList.length;

        const scheduleVariance = activeProjectsCount > 0 
            ? Math.round((delayedCount / activeProjectsCount) * 100) 
            : 0;

        const statusCounts: Record<string, number> = {};
        allProjects.forEach(p => {
            statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
        });

        const statusBreakdown = Object.entries(statusCounts).map(([status, count]) => ({
            status,
            count
        }));

        const delayedProjectsFormatted = delayedProjectsList.map(p => {
            const end = new Date(p.endDate!);
            const delayInMs = now.getTime() - end.getTime();
            const delayInDays = Math.ceil(delayInMs / (1000 * 60 * 60 * 24));
            
            let status = 'Normal';
            if (delayInDays > 15) {
                status = 'Critical';
            } else if (delayInDays > 0) {
                status = 'Warning';
            }

            return {
                name: p.name,
                delay: delayInDays,
                progress: p.progress,
                status
            };
        }).sort((a, b) => b.delay - a.delay);

        const recentLogs = await prisma.auditLog.findMany({
            take: 10,
            orderBy: { createdAt: 'desc' },
            include: {
                user: {
                    select: { name: true, email: true }
                }
            }
        });

        const recentActivities = recentLogs.map(log => {
            let actionType: "approval" | "alert" | "completion" | "upload" | "creation" = "creation";
            const actionLower = log.action.toLowerCase();
            if (actionLower.includes('approve')) {
                actionType = 'approval';
            } else if (actionLower.includes('fail') || actionLower.includes('alert') || actionLower.includes('warn') || actionLower.includes('reject')) {
                actionType = 'alert';
            } else if (actionLower.includes('complete') || actionLower.includes('close')) {
                actionType = 'completion';
            } else if (actionLower.includes('upload') || actionLower.includes('import')) {
                actionType = 'upload';
            }

            return {
                user: log.user.name || log.user.email,
                action: log.action,
                target: `${log.entity} #${log.entityId}`,
                time: formatDistanceToNow(new Date(log.createdAt), { addSuffix: true }),
                type: actionType
            };
        });

        if (recentActivities.length === 0) {
            recentActivities.push(
                {
                    user: "System",
                    action: "initialized",
                    target: "Dashboard Engine",
                    time: "Just now",
                    type: "creation"
                }
            );
        }

        return {
            overview: {
                activeProjects: activeProjectsCount,
                totalBudget,
                actualSpend,
                scheduleVariance,
                delayedCount
            },
            statusBreakdown,
            delayedProjects: delayedProjectsFormatted,
            recentActivities
        };
    }
}
