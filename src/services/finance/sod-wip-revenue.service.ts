import { prisma } from '@/lib/prisma';
import { safe } from '@/utils/safe-await.util';
import { safeJsonParse } from '@/utils/safeJsonParse';
import { SODInvoicingService } from '../service-order/sod.invoicing.service';
import { LedgerService, JournalPostingLineInput } from './ledger.service';
import { ACCOUNTS } from './account-codes';

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
        opmcId: string;
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
    id: string;
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
    static async getWipSummary(opmcId?: string, accessibleOpmcs?: string[]): Promise<{ metrics: WipSummaryMetrics; items: WipSodItem[] }> {
        const splitConfig = await this.getPaymentSplitConfig();

        // Accounting Rule: Only physically completed field jobs (COMPLETED, INSTALL_CLOSED, PROV_CLOSED)
        // qualify for Unbilled WIP Revenue Recognition. Unfinished PENDING/INPROGRESS jobs are excluded.
        const whereClause: Record<string, unknown> = {
            OR: [
                { sltsStatus: { in: ['COMPLETED', 'INSTALL_CLOSED', 'PROV_CLOSED'] } },
                { status: { in: ['COMPLETED', 'INSTALL_CLOSED', 'PAT_OPMC_PASSED', 'PAT_CORRECTED'] } }
            ],
            invoiced: { not: true }
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

        // 1. Fetch Unbilled Completed SODs
        const orders = await prisma.serviceOrder.findMany({
            where: whereClause,
            select: {
                id: true,
                soNum: true,
                voiceNumber: true,
                customerName: true,
                sltsStatus: true,
                status: true,
                opmcId: true,
                opmc: { select: { id: true, rtom: true, name: true } },
                receivedDate: true,
                scheduledDate: true,
                completedDate: true,
                createdAt: true,
                dropWireDistance: true,
                revenueAmount: true,
                contractorAmount: true,
                isInvoicable: true,
                sltsPatStatus: true,
                opmcPatStatus: true,
                materialUsage: {
                    select: {
                        quantity: true,
                        unitPrice: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

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

        for (const order of orders) {
            const rawDist = Number(order.dropWireDistance || 0);
            const rtomCode = order.opmc?.rtom || 'OTHER';

            let accruedRevenue = Number(order.revenueAmount || 0);
            let contractorCost = Number(order.contractorAmount || 0);

            // If amounts not computed, calculate dynamically from rate matrix based on distance (m)
            if (accruedRevenue === 0 || contractorCost === 0) {
                const rates = await SODInvoicingService.calculateAmounts(rtomCode, rawDist);
                if (accruedRevenue === 0) accruedRevenue = rates.revenueAmount;
                if (contractorCost === 0) contractorCost = rates.contractorAmount;
            }

            // Calculate Material COGS for this SOD from inventory material usage records
            let materialCost = 0;
            if (order.materialUsage && Array.isArray(order.materialUsage)) {
                for (const mu of order.materialUsage) {
                    const qty = parseFloat(String(mu.quantity || '0'));
                    const price = parseFloat(String(mu.unitPrice || '0'));
                    materialCost += qty * price;
                }
            }

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
                name: order.opmc?.name || 'Unassigned OPMC',
                wipValue: 0,
                count: 0
            };
            existingOp.wipValue += accruedRevenue;
            existingOp.count++;
            opmcMap.set(opKey, existingOp);

            const patStatus = order.sltsPatStatus || order.opmcPatStatus || (order.isInvoicable ? 'PASSED' : 'PENDING');

            items.push({
                id: order.id,
                soNum: order.soNum,
                voiceNumber: order.voiceNumber,
                customerName: order.customerName,
                rtom: rtomCode,
                sltsStatus: order.sltsStatus || order.status || 'COMPLETED',
                scheduledDate: order.scheduledDate ? new Date(order.scheduledDate) : null,
                completedDate: order.completedDate ? new Date(order.completedDate) : null,
                dropWireDistance: rawDist,
                accruedRevenue,
                contractorCost,
                materialCost,
                netMargin,
                netMarginPercent,
                claimAAmount,
                claimBAmount,
                isInvoicable: !!order.isInvoicable,
                patStatus,
                ageDays
            });
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
            unbilledSodCount: orders.length,
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

        return { metrics, items };
    }

    /**
     * Post Period-End WIP Revenue Accrual & Material COGS Journal Entry to General Ledger
     */
    static async postWipAccrualJournal(createdById?: string) {
        const { metrics } = await this.getWipSummary();

        if (metrics.totalWipValue <= 0) {
            return { posted: false, message: 'No unbilled WIP revenue available to accrue' };
        }

        return await prisma.$transaction(async (tx) => {
            const periodStr = new Date().toISOString().slice(0, 7);
            const refId = `WIP-ACCRUAL-${periodStr}`;

            const lines: JournalPostingLineInput[] = [
                {
                    accountCode: ACCOUNTS.AR_CLIENT,
                    debit: metrics.totalWipValue,
                    credit: 0,
                    description: `Accrued Unbilled WIP Revenue Asset for ${metrics.unbilledSodCount} SODs`
                },
                {
                    accountCode: ACCOUNTS.REVENUE,
                    debit: 0,
                    credit: metrics.totalWipValue,
                    description: `Accrued Project Revenue for ${periodStr}`
                }
            ];

            // If Material COGS exists, post DR COGS / CR Raw Material Inventory
            if (metrics.totalMaterialCogs > 0) {
                lines.push(
                    {
                        accountCode: ACCOUNTS.COGS,
                        debit: metrics.totalMaterialCogs,
                        credit: 0,
                        description: `Material COGS Expense for ${metrics.unbilledSodCount} SODs`
                    },
                    {
                        accountCode: ACCOUNTS.INVENTORY,
                        debit: 0,
                        credit: metrics.totalMaterialCogs,
                        description: `Inventory Consumption for ${metrics.unbilledSodCount} SODs`
                    }
                );
            }

            const journal = await LedgerService.postTransaction(tx, {
                referenceId: refId,
                referenceType: 'WIP_REVENUE_ACCRUAL',
                description: `Monthly Work-In-Progress (WIP) Revenue & Inventory COGS Accrual for ${periodStr}`,
                createdById,
                lines
            });

            return { posted: true, journalId: journal.id, accruedValue: metrics.totalWipValue, materialCogs: metrics.totalMaterialCogs };
        });
    }
}
