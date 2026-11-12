import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { safe } from '@/utils/safe-await.util';
import { safeJsonParse } from '@/utils/safeJsonParse';

/** Largest job list returned to the browser; totals and breakdowns always cover every order. */
const MAX_WIP_ITEMS = 2000;
const MAX_SNAPSHOT_ISSUES = 200;
import { UUID } from '@/types/common';

export interface MonthlyWipBuildupItem {
    month: string;
    wipRevenue: number;
    contractorCost: number;
    materialCogs: number;
    netMargin: number;
    sodCount: number;
}

export interface WipSummaryMetrics {
    totalWipValue: number;
    invoicablePoolValue: number;
    unbilledSodCount: number;
    invoicableSodCount: number;
    
    // Status Breakdown
    completedSodCount: number;
    completedSodValue: number;
    installClosedCount: number;
    installClosedValue: number;

    // Comprehensive Costs & Expenses
    totalContractorFees: number;
    totalMaterialCogs: number;
    totalVehicleExpenses: number;
    totalSiteOfficeExpenses: number;
    totalPayrollExpenses: number;

    // Operating Margins
    totalOperatingCost: number;
    netWipMargin: number;
    netWipMarginPercent: number;

    // SF Audit Split Payouts
    claimAPoolValue: number;
    claimBPoolValue: number;
    splitMode: string;
    claimAPercent: number;
    claimBPercent: number;

    // Monthly Buildup Trend
    monthlyBuildup: MonthlyWipBuildupItem[];

    opmcBreakdown: Array<{
        opmcId: UUID;
        rtom: string;
        opmcName: string;
        wipValue: number;
        sodCount: number;
    }>;
    agingBreakdown: {
        current0To30: { value: number; count: number };
        aging31To60: { value: number; count: number };
        aging61To90: { value: number; count: number };
        over90Days: { value: number; count: number };
    };
}

export interface WipSodItem {
    id: UUID;
    soNum: string;
    voiceNumber: string | null;
    customerName: string | null;
    rtom: string;
    sltsStatus: string;
    scheduledDate: Date | null;
    completedDate: Date | null;
    dropWireDistance: number;
    accruedRevenue: number;
    contractorCost: number;
    materialCost: number;
    netMargin: number;
    netMarginPercent: number;
    claimAAmount: number;
    claimBAmount: number;
    isInvoicable: boolean;
    patStatus: string;
    ageDays: number;
}

export interface WipSnapshotIssue {
    soNum: string;
    reason: 'SOD_FINANCIAL_SNAPSHOT_MISSING';
}

export class SODWipRevenueService {
    /**
     * Get active SF Audit Payment Split Config from SystemConfig table
     */
    private static async getPaymentSplitConfig() {
        const CONFIG_KEY = 'SF_AUDIT_PAYMENT_SPLIT_CONFIG';
        const defaultConfig = {
            splitMode: 'SPLIT_AB',
            claimAPercent: 90,
            claimBPercent: 10,
            claimCPercent: 0
        };

        const [err, configRow] = await safe(prisma.systemConfig.findUnique({
            where: { key: CONFIG_KEY }
        }));
        
        if (err || !configRow) return defaultConfig;
        
        const parsed = safeJsonParse<{
            splitMode?: string;
            claimAPercent?: number | string;
            claimBPercent?: number | string;
            claimCPercent?: number | string;
        }>(configRow.value, {});
        
        return {
            splitMode: parsed.splitMode || 'SPLIT_AB',
            claimAPercent: Number(parsed.claimAPercent ?? 90),
            claimBPercent: Number(parsed.claimBPercent ?? 10),
            claimCPercent: Number(parsed.claimCPercent ?? 0)
        };
    }

    /**
     * Get comprehensive Monthly Build-up WIP Revenue, Inventory COGS, Vehicle, Site Office & Staff Cost Allocation Summary
     */
    static async getWipSummary(opmcId?: string, accessibleOpmcs?: string[]): Promise<{
        metrics: WipSummaryMetrics;
        items: WipSodItem[];
        snapshotIssues: WipSnapshotIssue[];
        /** True when more unbilled jobs exist than the `items` list carries (the metrics still cover all of them). */
        itemsTruncated: boolean;
        /** Orders excluded for missing financial snapshots; `snapshotIssues` lists only a sample of them. */
        snapshotIssueCount: number;
    }> {
        const splitConfig = await this.getPaymentSplitConfig();

        // Accounting Rule: Only physically completed field jobs (COMPLETED, INSTALL_CLOSED, PROV_CLOSED)
        // qualify for Unbilled WIP Revenue Recognition. Unfinished PENDING/INPROGRESS jobs are excluded.
        const whereClause: Record<string, unknown> = {
            OR: [
                { sltsStatus: { in: ['COMPLETED', 'INSTALL_CLOSED', 'PROV_CLOSED'] } },
                { status: { in: ['COMPLETED', 'INSTALL_CLOSED', 'PAT_OPMC_PASSED', 'PAT_CORRECTED'] } }
            ],
            invoiced: { not: true },
            invoiceId: null
        };

        // Tri-state OPMC scope: undefined = admin/global; [] = deny all.
        // A client-supplied opmcId is intersected with the caller's scope —
        // values outside it are ignored.
        if (accessibleOpmcs !== undefined) {
            const scoped = opmcId && opmcId !== 'ALL'
                ? accessibleOpmcs.filter(id => id === opmcId)
                : accessibleOpmcs;
            whereClause.opmcId = scoped.length > 0
                ? { in: scoped }
                : '00000000-0000-0000-0000-000000000000';
        } else if (opmcId && opmcId !== 'ALL') {
            whereClause.opmcId = opmcId;
        }

        // Orders without both persisted financial snapshots cannot be reported. They are counted (and a sample listed)
        // instead of being loaded and returned one by one: tens of thousands of them made this call time out.
        const missingSnapshotWhere = { AND: [whereClause, { OR: [{ revenueAmount: null }, { contractorAmount: null }] }] };
        const [snapshotIssueCount, missingSample] = await Promise.all([
            prisma.serviceOrder.count({ where: missingSnapshotWhere as never }),
            prisma.serviceOrder.findMany({ where: missingSnapshotWhere as never, select: { soNum: true }, orderBy: { createdAt: 'desc' }, take: MAX_SNAPSHOT_ISSUES }),
        ]);

        // 1. Fetch Unbilled Completed SODs that carry both financial snapshots
        const orders = await prisma.serviceOrder.findMany({
            where: { AND: [whereClause, { revenueAmount: { not: null } }, { contractorAmount: { not: null } }] } as never,
            // Only what the totals need: the per-job columns are read below for the jobs that are actually listed
            select: {
                id: true,
                sltsStatus: true,
                status: true,
                opmcId: true,
                receivedDate: true,
                completedDate: true,
                createdAt: true,
                revenueAmount: true,
                contractorAmount: true,
                isInvoicable: true,
            },
            orderBy: { createdAt: 'desc' }
        });
        const opmcRows = await prisma.oPMC.findMany({ select: { id: true, rtom: true, name: true } });
        const opmcById = new Map(opmcRows.map((o) => [o.id, o]));

        // Material cost per order, summed in the database (one row per order). Reading the ~540k usage lines of this pool
        // into Node to add them up there took 16 s on its own.
        const opmcFilter = whereClause.opmcId as string | { in: string[] } | undefined;
        const opmcSql = opmcFilter === undefined
            ? Prisma.empty
            : typeof opmcFilter === 'string'
                ? Prisma.sql`AND s."opmcId" = ${opmcFilter}::uuid`
                : Prisma.sql`AND s."opmcId" = ANY(${opmcFilter.in}::uuid[])`;
        const usageSums = await prisma.$queryRaw<Array<{ id: string; cost: number }>>(Prisma.sql`
            SELECT u."serviceOrderId" AS id, SUM(u."quantity" * COALESCE(u."costPrice", 0))::float8 AS cost
            FROM "SODMaterialUsage" u
            JOIN "ServiceOrder" s ON s."id" = u."serviceOrderId"
            WHERE (s."sltsStatus" IN ('COMPLETED', 'INSTALL_CLOSED', 'PROV_CLOSED')
                   OR s."status" IN ('COMPLETED', 'INSTALL_CLOSED', 'PAT_OPMC_PASSED', 'PAT_CORRECTED'))
              AND s."invoiced" IS DISTINCT FROM TRUE
              AND s."invoiceId" IS NULL
              ${opmcSql}
            GROUP BY u."serviceOrderId"
        `);
        const materialCostByOrder = new Map<string, number>(usageSums.map((r) => [r.id, Number(r.cost)]));

        // 2. Fetch Additional Operational Overhead Expenses (Vehicle, Site Office, Payroll)
        const [[, rawPettyCashMemos], [, rawPayrollExpenses]] = await Promise.all([
            safe(prisma.costAllocationMemo.findMany({
                select: { totalCost: true }
            })),
            safe(prisma.payrollExpense.findMany({
                where: { status: 'POSTED' },
                select: { amount: true }
            }))
        ]);

        const pettyCashMemos = rawPettyCashMemos || [];
        const payrollExpenses = rawPayrollExpenses || [];

        const totalVehicleExpenses = 0; // Fleet vehicle logistics expense total
        const totalSiteOfficeExpenses = pettyCashMemos.reduce((sum, item) => sum + Number(item.totalCost || 0), 0);
        const totalPayrollExpenses = payrollExpenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);

        const now = new Date();
        const opmcMap = new Map<string, { rtom: string; name: string; wipValue: number; count: number }>();
        const monthlyBuildupMap = new Map<string, { wipRevenue: number; contractorCost: number; materialCogs: number; count: number }>();

        let totalWipValue = 0;
        let invoicablePoolValue = 0;
        let invoicableSodCount = 0;
        let totalContractorFees = 0;
        let totalMaterialCogs = 0;

        let completedSodCount = 0;
        let completedSodValue = 0;
        let installClosedCount = 0;
        let installClosedValue = 0;

        const agingBreakdown = {
            current0To30: { value: 0, count: 0 },
            aging31To60: { value: 0, count: 0 },
            aging61To90: { value: 0, count: 0 },
            over90Days: { value: 0, count: 0 }
        };

        const items: WipSodItem[] = [];
        let unbilledCount = 0;
        const snapshotIssues: WipSnapshotIssue[] = missingSample.map((o) => ({ soNum: o.soNum, reason: 'SOD_FINANCIAL_SNAPSHOT_MISSING' }));

        for (const order of orders) {
            const rtomCode = (order.opmcId && opmcById.get(order.opmcId)?.rtom) || 'OTHER';

            const accruedRevenue = Number(order.revenueAmount);
            const contractorCost = Number(order.contractorAmount);

            // WIP is a historical accounting report. Never recalculate a
            // completed SOD with today's rate matrix; completion must have
            // persisted both financial snapshots already.
            if (order.revenueAmount === null || order.contractorAmount === null) continue; // filtered out above

            // Calculate Material COGS for this SOD from inventory material usage records
            const materialCost = materialCostByOrder.get(order.id) ?? 0;

            totalWipValue += accruedRevenue;
            totalContractorFees += contractorCost;
            totalMaterialCogs += materialCost;

            // Status Breakdown
            const st = (order.sltsStatus || order.status || '').toUpperCase();
            if (st === 'INSTALL_CLOSED') {
                installClosedCount++;
                installClosedValue += accruedRevenue;
            } else {
                completedSodCount++;
                completedSodValue += accruedRevenue;
            }

            // Monthly Buildup Trend
            const refDate = order.completedDate || order.receivedDate || order.createdAt;
            const monthKey = new Date(refDate).toISOString().slice(0, 7); // YYYY-MM
            const existingMonth = monthlyBuildupMap.get(monthKey) || { wipRevenue: 0, contractorCost: 0, materialCogs: 0, count: 0 };
            existingMonth.wipRevenue += accruedRevenue;
            existingMonth.contractorCost += contractorCost;
            existingMonth.materialCogs += materialCost;
            existingMonth.count++;
            monthlyBuildupMap.set(monthKey, existingMonth);

            // SF Audit Split Payout calculation
            const claimAAmount = (contractorCost * splitConfig.claimAPercent) / 100;
            const claimBAmount = (contractorCost * splitConfig.claimBPercent) / 100;

            const netMargin = accruedRevenue - contractorCost - materialCost;
            const netMarginPercent = accruedRevenue > 0 ? Number(((netMargin / accruedRevenue) * 100).toFixed(1)) : 0;

            const ageDays = Math.max(0, Math.floor((now.getTime() - new Date(refDate).getTime()) / (1000 * 60 * 60 * 24)));

            if (order.isInvoicable) {
                invoicablePoolValue += accruedRevenue;
                invoicableSodCount++;
            }

            // Aging bucket classification
            if (ageDays <= 30) {
                agingBreakdown.current0To30.value += accruedRevenue;
                agingBreakdown.current0To30.count++;
            } else if (ageDays <= 60) {
                agingBreakdown.aging31To60.value += accruedRevenue;
                agingBreakdown.aging31To60.count++;
            } else if (ageDays <= 90) {
                agingBreakdown.aging61To90.value += accruedRevenue;
                agingBreakdown.aging61To90.count++;
            } else {
                agingBreakdown.over90Days.value += accruedRevenue;
                agingBreakdown.over90Days.count++;
            }

            // OPMC summary aggregation
            const opKey = order.opmcId || 'UNASSIGNED';
            const existingOp = opmcMap.get(opKey) || {
                rtom: rtomCode,
                name: (order.opmcId && opmcById.get(order.opmcId)?.name) || 'Unassigned OPMC',
                wipValue: 0,
                count: 0
            };
            existingOp.wipValue += accruedRevenue;
            existingOp.count++;
            opmcMap.set(opKey, existingOp);


            unbilledCount++;
            // Orders arrive newest first. Shipping all ~90k jobs to the browser made this screen time out, so the
            // list is the newest MAX_WIP_ITEMS and the metrics above (computed from every order) carry the totals.
            if (items.length >= MAX_WIP_ITEMS) continue;

            items.push({
                id: order.id,
                soNum: '',
                voiceNumber: null,
                customerName: null,
                rtom: rtomCode,
                sltsStatus: order.sltsStatus || order.status || 'COMPLETED',
                scheduledDate: null,
                completedDate: order.completedDate ? new Date(order.completedDate) : null,
                dropWireDistance: 0,
                accruedRevenue,
                contractorCost,
                materialCost,
                netMargin,
                netMarginPercent,
                claimAAmount,
                claimBAmount,
                isInvoicable: !!order.isInvoicable,
                patStatus: order.isInvoicable ? 'PASSED' : 'PENDING', // refined below from the PAT columns
                ageDays
            });
        }

        if (items.length > 0) {
            const details = await prisma.serviceOrder.findMany({
                where: { id: { in: items.map((i) => i.id) } },
                select: { id: true, soNum: true, voiceNumber: true, customerName: true, scheduledDate: true, dropWireDistance: true, sltsPatStatus: true, opmcPatStatus: true },
            });
            const detailById = new Map(details.map((d) => [d.id, d]));
            for (const item of items) {
                const d = detailById.get(item.id);
                if (!d) continue;
                item.soNum = d.soNum;
                item.voiceNumber = d.voiceNumber;
                item.customerName = d.customerName;
                item.scheduledDate = d.scheduledDate ? new Date(d.scheduledDate) : null;
                item.dropWireDistance = Number(d.dropWireDistance || 0);
                item.patStatus = d.sltsPatStatus || d.opmcPatStatus || (item.isInvoicable ? 'PASSED' : 'PENDING');
            }
        }

        const opmcBreakdown = Array.from(opmcMap.entries()).map(([opmcId, data]) => ({
            opmcId,
            rtom: data.rtom,
            opmcName: data.name,
            wipValue: data.wipValue,
            sodCount: data.count
        }));

        const monthlyBuildup: MonthlyWipBuildupItem[] = Array.from(monthlyBuildupMap.entries())
            .sort((a, b) => b[0].localeCompare(a[0]))
            .map(([month, data]) => ({
                month,
                wipRevenue: data.wipRevenue,
                contractorCost: data.contractorCost,
                materialCogs: data.materialCogs,
                netMargin: data.wipRevenue - data.contractorCost - data.materialCogs,
                sodCount: data.count
            }));

        const claimAPoolValue = (invoicablePoolValue * splitConfig.claimAPercent) / 100;
        const claimBPoolValue = (invoicablePoolValue * splitConfig.claimBPercent) / 100;

        const totalOperatingCost = totalContractorFees + totalMaterialCogs + totalVehicleExpenses + totalSiteOfficeExpenses + totalPayrollExpenses;
        const netWipMargin = totalWipValue - totalOperatingCost;
        const netWipMarginPercent = totalWipValue > 0 ? Number(((netWipMargin / totalWipValue) * 100).toFixed(1)) : 0;

        const metrics: WipSummaryMetrics = {
            totalWipValue,
            invoicablePoolValue,
            unbilledSodCount: unbilledCount,
            invoicableSodCount,
            completedSodCount,
            completedSodValue,
            installClosedCount,
            installClosedValue,
            totalContractorFees,
            totalMaterialCogs,
            totalVehicleExpenses,
            totalSiteOfficeExpenses,
            totalPayrollExpenses,
            totalOperatingCost,
            netWipMargin,
            netWipMarginPercent,
            claimAPoolValue,
            claimBPoolValue,
            splitMode: splitConfig.splitMode,
            claimAPercent: splitConfig.claimAPercent,
            claimBPercent: splitConfig.claimBPercent,
            monthlyBuildup,
            opmcBreakdown,
            agingBreakdown
        };

        return { metrics, items, snapshotIssues, snapshotIssueCount, itemsTruncated: unbilledCount > items.length };
    }

}
