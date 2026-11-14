import { prisma } from '@/lib/prisma';
import { ACCOUNTS } from './account-codes';

export interface FpaMetrics {
    totalRevenue: number;
    totalCOGS: number;
    grossMargin: number;
    grossMarginPct: number;
    totalOpex: number;
    netProfit: number;
    netProfitPct: number;
}

export interface FpaMonth {
    month: string; // YYYY-MM
    revenue: number;
    directCost: number;
    opex: number;
    netProfit: number;
}

export interface FpaExpenseLine { code: string; name: string; amount: number; sharePct: number }

export interface PredictiveFPAMetrics extends FpaMetrics {
    period: string; // e.g. "2026-Q3" or "2026"
    /** Same length period immediately before (previous quarter, or previous year for a full-year view). */
    previous: FpaMetrics & { period: string };
    /** Same period one year earlier (YoY). */
    priorYear: FpaMetrics & { period: string };
    /** Monthly trend for the selected calendar year. */
    monthly: FpaMonth[];
    /** Largest expense accounts in the selected period. */
    topExpenses: FpaExpenseLine[];
}

type AccountKind = 'REVENUE' | 'DIRECT_COST' | 'OPEX' | 'OTHER';

/** Direct (cost-of-delivery) expense accounts; every other EXPENSE account is operating expense. */
const DIRECT_COST_CODES = new Set<string>([
    ACCOUNTS.COGS, ACCOUNTS.SUBCONTRACTOR, ACCOUNTS.CONTRACTOR_EXPENSE,
    ACCOUNTS.WASTAGE_EXPENSE, ACCOUNTS.INVENTORY_VARIANCE, ACCOUNTS.OSP_EXPENSE,
]);

/**
 * Classify an account from the chart of accounts, never from its code prefix: real codes are
 * alphanumeric (REV-4010, EXP-STAFF-6010), so numeric-prefix rules classify nothing.
 */
export function classifyAccount(code: string, type: string | undefined): AccountKind {
    if (type === 'REVENUE') return 'REVENUE';
    if (type === 'EXPENSE') return DIRECT_COST_CODES.has(code) ? 'DIRECT_COST' : 'OPEX';
    return 'OTHER';
}

export function periodBounds(year: number, quarter?: number) {
    if (quarter) {
        const start = new Date(Date.UTC(year, (quarter - 1) * 3, 1));
        const end = new Date(Date.UTC(year, quarter * 3, 1) - 1);
        return { start, end, name: `${year}-Q${quarter}` };
    }
    return { start: new Date(Date.UTC(year, 0, 1)), end: new Date(Date.UTC(year + 1, 0, 1) - 1), name: `${year}` };
}

export function previousPeriod(year: number, quarter?: number) {
    if (!quarter) return { year: year - 1, quarter: undefined };
    return quarter === 1 ? { year: year - 1, quarter: 4 } : { year, quarter: quarter - 1 };
}

const pct = (num: number, den: number) => (den > 0 ? Number(((num / den) * 100).toFixed(2)) : 0);

function toMetrics(revenue: number, direct: number, opex: number): FpaMetrics {
    const grossMargin = revenue - direct;
    const netProfit = grossMargin - opex;
    return {
        totalRevenue: revenue, totalCOGS: direct, grossMargin, grossMarginPct: pct(grossMargin, revenue),
        totalOpex: opex, netProfit, netProfitPct: pct(netProfit, revenue),
    };
}

export class FPADashboardService {
    private static async coaMap() {
        const coa = await prisma.chartOfAccount.findMany({ select: { code: true, name: true, type: true } });
        return new Map(coa.map((a) => [a.code, a]));
    }

    /** Aggregate a date range from the ledger. Reversed originals are included: their reversal entry cancels them. */
    private static async aggregate(start: Date, end: Date, coa: Map<string, { code: string; name: string; type: string }>) {
        const lines = await prisma.journalLine.groupBy({
            by: ['accountCode'],
            where: { entry: { date: { gte: start, lte: end }, status: { in: ['POSTED', 'REVERSED'] } } },
            _sum: { debit: true, credit: true },
        });
        let revenue = 0, direct = 0, opex = 0;
        const expenses: { code: string; name: string; amount: number }[] = [];
        for (const l of lines) {
            const debit = Number(l._sum.debit || 0);
            const credit = Number(l._sum.credit || 0);
            const account = coa.get(l.accountCode);
            const kind = classifyAccount(l.accountCode, account?.type);
            if (kind === 'REVENUE') revenue += credit - debit;
            else if (kind === 'DIRECT_COST') { direct += debit - credit; expenses.push({ code: l.accountCode, name: account?.name ?? l.accountCode, amount: debit - credit }); }
            else if (kind === 'OPEX') { opex += debit - credit; expenses.push({ code: l.accountCode, name: account?.name ?? l.accountCode, amount: debit - credit }); }
        }
        return { metrics: toMetrics(revenue, direct, opex), expenses };
    }

    private static async monthlySeries(year: number, coa: Map<string, { code: string; name: string; type: string }>): Promise<FpaMonth[]> {
        const start = new Date(Date.UTC(year, 0, 1));
        const end = new Date(Date.UTC(year + 1, 0, 1) - 1);
        const rows = await prisma.$queryRaw<{ m: string; code: string; debit: unknown; credit: unknown }[]>`
            SELECT to_char(date_trunc('month', e."date"), 'YYYY-MM') AS m, l."accountCode" AS code,
                   COALESCE(SUM(l."debit"), 0) AS debit, COALESCE(SUM(l."credit"), 0) AS credit
            FROM "JournalLine" l JOIN "JournalEntry" e ON e."id" = l."entryId"
            WHERE e."status" IN ('POSTED', 'REVERSED') AND e."date" >= ${start} AND e."date" <= ${end}
            GROUP BY 1, 2`;
        const months = new Map<string, { revenue: number; direct: number; opex: number }>();
        for (let i = 0; i < 12; i++) months.set(`${year}-${String(i + 1).padStart(2, '0')}`, { revenue: 0, direct: 0, opex: 0 });
        for (const r of rows) {
            const bucket = months.get(r.m);
            if (!bucket) continue;
            const debit = Number(r.debit);
            const credit = Number(r.credit);
            const kind = classifyAccount(r.code, coa.get(r.code)?.type);
            if (kind === 'REVENUE') bucket.revenue += credit - debit;
            else if (kind === 'DIRECT_COST') bucket.direct += debit - credit;
            else if (kind === 'OPEX') bucket.opex += debit - credit;
        }
        return [...months.entries()].map(([month, v]) => ({
            month, revenue: v.revenue, directCost: v.direct, opex: v.opex, netProfit: v.revenue - v.direct - v.opex,
        }));
    }

    /**
     * Executive profitability dashboard: the selected period, the period before it, the same period a
     * year earlier, a 12-month trend and the largest expense lines.
     */
    static async getPredictiveProfitability(year: number, quarter?: number): Promise<PredictiveFPAMetrics> {
        const coa = await this.coaMap();
        const cur = periodBounds(year, quarter);
        const prev = previousPeriod(year, quarter);
        const prevB = periodBounds(prev.year, prev.quarter);
        const pyB = periodBounds(year - 1, quarter);

        const current = await this.aggregate(cur.start, cur.end, coa);
        const previous = await this.aggregate(prevB.start, prevB.end, coa);
        const priorYear = await this.aggregate(pyB.start, pyB.end, coa);
        const monthly = await this.monthlySeries(year, coa);

        const totalExpense = current.expenses.reduce((a, e) => a + Math.max(e.amount, 0), 0);
        const topExpenses = current.expenses
            .filter((e) => e.amount > 0)
            .sort((a, b) => b.amount - a.amount)
            .slice(0, 8)
            .map((e) => ({ ...e, sharePct: pct(e.amount, totalExpense) }));

        return {
            period: cur.name,
            ...current.metrics,
            previous: { period: prevB.name, ...previous.metrics },
            priorYear: { period: pyB.name, ...priorYear.metrics },
            monthly,
            topExpenses,
        };
    }
}
