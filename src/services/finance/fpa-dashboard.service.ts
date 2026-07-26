import { prisma } from '@/lib/prisma';

export interface PredictiveFPAMetrics {
    period: string; // e.g. "2026-Q3"
    totalRevenue: number;
    totalCOGS: number;
    grossMargin: number;
    grossMarginPct: number;
    totalOpex: number;
    netProfit: number;
    netProfitPct: number;
}

export class FPADashboardService {
    /**
     * Get Executive Financial Variance & Profitability Dashboard metrics.
     * Uses O(N) DB-level aggregation to prevent massive RAM spikes.
     */
    static async getPredictiveProfitability(year: number, quarter?: number): Promise<PredictiveFPAMetrics> {
        let periodName = `${year}`;
        let startDate = new Date(`${year}-01-01T00:00:00Z`);
        let endDate = new Date(`${year}-12-31T23:59:59Z`);

        if (quarter) {
            periodName = `${year}-Q${quarter}`;
            const startMonth = (quarter - 1) * 3 + 1;
            const endMonth = quarter * 3;
            startDate = new Date(`${year}-${startMonth.toString().padStart(2, '0')}-01T00:00:00Z`);
            endDate = new Date(year, endMonth, 0, 23, 59, 59); // Last day of quarter
        }

        // Fetch aggregated actuals from JournalLines between the dates
        // Revenue: 4xxx, COGS: 50xx, Opex: 5xxx to 6xxx
        const journalLines = await prisma.journalLine.groupBy({
            by: ['accountCode'],
            where: {
                entry: {
                    date: { gte: startDate, lte: endDate },
                    status: 'POSTED'
                }
            },
            _sum: {
                debit: true,
                credit: true
            }
        });

        let totalRevenue = 0;
        let totalCOGS = 0;
        let totalOpex = 0;

        for (const line of journalLines) {
            const debit = Number(line._sum.debit || 0);
            const credit = Number(line._sum.credit || 0);
            const netBalance = credit - debit; // For Revenue/Liabilities, Credit is positive. For Expenses/Assets, Debit is positive.

            if (line.accountCode.startsWith('4')) {
                // Revenue
                totalRevenue += netBalance; 
            } else if (line.accountCode === '5001' || line.accountCode.startsWith('50')) {
                // COGS (Direct Material Costs)
                // Expense normal balance is Debit
                totalCOGS += (debit - credit);
            } else if (line.accountCode.startsWith('6') || (line.accountCode.startsWith('5') && line.accountCode !== '5001')) {
                // OPEX / G&A (Operating Expenses)
                totalOpex += (debit - credit);
            }
        }

        const grossMargin = totalRevenue - totalCOGS;
        const grossMarginPct = totalRevenue > 0 ? (grossMargin / totalRevenue) * 100 : 0;
        
        const netProfit = grossMargin - totalOpex;
        const netProfitPct = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

        return {
            period: periodName,
            totalRevenue,
            totalCOGS,
            grossMargin,
            grossMarginPct: Number(grossMarginPct.toFixed(2)),
            totalOpex,
            netProfit,
            netProfitPct: Number(netProfitPct.toFixed(2))
        };
    }
}
