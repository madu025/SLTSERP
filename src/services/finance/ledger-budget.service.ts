import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';
import { resolveOpmcScope } from '@/lib/opmc-scope';

export interface BudgetVsActualRow {
    accountCode: string;
    accountName: string;
    kind: 'REVENUE' | 'EXPENSE';
    annualBudget: number;
    ytdBudget: number;
    ytdActual: number;
    /** Favourable is positive: revenue above budget, or expense below budget. */
    variance: number;
    variancePct: number | null;
    monthlyBudget: number[]; // 12
    monthlyActual: number[]; // 12
}

export interface BudgetVsActualReport {
    fiscalYear: number;
    throughMonth: number;
    opmcId: string | null;
    rows: BudgetVsActualRow[];
    totals: { revenueBudget: number; revenueActual: number; expenseBudget: number; expenseActual: number; netBudget: number; netActual: number };
    hasBudget: boolean;
}

/** Variance where a positive number is always good news. */
export function favourableVariance(kind: 'REVENUE' | 'EXPENSE', budget: number, actual: number): number {
    return kind === 'REVENUE' ? actual - budget : budget - actual;
}

/** Split an annual amount into 12 monthly amounts that add back up to exactly the annual figure. */
export function spreadAnnual(annual: number): number[] {
    const cents = Math.round(annual * 100);
    const base = Math.floor(cents / 12);
    const months = new Array<number>(12).fill(base);
    months[11] += cents - base * 12;
    return months.map((c) => c / 100);
}

/** Expense accounts running more than `tolerancePct` over their year-to-date budget. */
export function expenseOverruns(rows: BudgetVsActualRow[], tolerancePct = 10): BudgetVsActualRow[] {
    return rows
        .filter((r) => r.kind === 'EXPENSE' && r.ytdBudget > 0 && r.ytdActual > r.ytdBudget * (1 + tolerancePct / 100))
        .sort((a, b) => a.variance - b.variance);
}

export class LedgerBudgetService {
    /**
     * Company-wide report for system/management callers that already enforce company-wide access
     * (it skips the per-user OPMC scope that getBudgetVsActual applies).
     */
    static async getCompanyBudgetVsActual(fiscalYear: number, now = new Date()): Promise<BudgetVsActualReport> {
        return this.computeReport(fiscalYear, null, now);
    }

    /** Resolve which OPMC a caller may read/write: company-wide only for unscoped users. */
    private static async resolveTarget(userId: string | null | undefined, requested: string | null | undefined) {
        const scope = await resolveOpmcScope(userId);
        if (scope === undefined) return { opmcId: requested ?? null, scope };
        if (!requested) throw AppError.forbidden('Company-wide budgets are available only to users with company-wide access; choose one of your OPMCs');
        if (!scope.includes(requested)) throw AppError.forbidden('That OPMC is outside your access');
        return { opmcId: requested, scope };
    }

    static async getBudgetVsActual(userId: string | null | undefined, fiscalYear: number, requestedOpmcId?: string | null, now = new Date()): Promise<BudgetVsActualReport> {
        const { opmcId } = await this.resolveTarget(userId, requestedOpmcId);
        return this.computeReport(fiscalYear, opmcId, now);
    }

    private static async computeReport(fiscalYear: number, opmcId: string | null, now: Date): Promise<BudgetVsActualReport> {
        const throughMonth = fiscalYear < now.getUTCFullYear() ? 12 : fiscalYear > now.getUTCFullYear() ? 0 : now.getUTCMonth() + 1;
        const start = new Date(Date.UTC(fiscalYear, 0, 1));
        const end = new Date(Date.UTC(fiscalYear + 1, 0, 1) - 1);

        const [budgets, coa, actualRows] = await Promise.all([
            prisma.ledgerBudgetLine.findMany({ where: { fiscalYear, opmcId }, select: { accountCode: true, month: true, amount: true } }),
            prisma.chartOfAccount.findMany({ where: { type: { in: ['REVENUE', 'EXPENSE'] } }, select: { code: true, name: true, type: true } }),
            prisma.$queryRaw<{ m: number; code: string; debit: unknown; credit: unknown }[]>`
                SELECT EXTRACT(MONTH FROM e."date")::int AS m, l."accountCode" AS code,
                       COALESCE(SUM(l."debit"), 0) AS debit, COALESCE(SUM(l."credit"), 0) AS credit
                FROM "JournalLine" l JOIN "JournalEntry" e ON e."id" = l."entryId"
                WHERE e."status" IN ('POSTED', 'REVERSED') AND e."date" >= ${start} AND e."date" <= ${end}
                  AND (${opmcId}::uuid IS NULL OR e."opmcId" = ${opmcId}::uuid)
                GROUP BY 1, 2`,
        ]);

        const byCode = new Map(coa.map((a) => [a.code, a]));
        const monthlyBudget = new Map<string, number[]>();
        const monthlyActual = new Map<string, number[]>();
        const slot = (m: Map<string, number[]>, code: string) => m.get(code) ?? (m.set(code, new Array<number>(12).fill(0)), m.get(code)!);

        for (const b of budgets) if (b.month >= 1 && b.month <= 12) slot(monthlyBudget, b.accountCode)[b.month - 1] += Number(b.amount);
        for (const r of actualRows) {
            const account = byCode.get(r.code);
            if (!account || r.m < 1 || r.m > 12) continue;
            const net = account.type === 'REVENUE' ? Number(r.credit) - Number(r.debit) : Number(r.debit) - Number(r.credit);
            slot(monthlyActual, r.code)[r.m - 1] += net;
        }

        const codes = new Set<string>([...monthlyBudget.keys(), ...monthlyActual.keys()]);
        const rows: BudgetVsActualRow[] = [];
        for (const code of codes) {
            const account = byCode.get(code);
            if (!account) continue;
            const kind = account.type === 'REVENUE' ? 'REVENUE' : 'EXPENSE';
            const mb = monthlyBudget.get(code) ?? new Array<number>(12).fill(0);
            const ma = monthlyActual.get(code) ?? new Array<number>(12).fill(0);
            const ytdBudget = mb.slice(0, throughMonth).reduce((a, v) => a + v, 0);
            const ytdActual = ma.slice(0, throughMonth).reduce((a, v) => a + v, 0);
            const variance = favourableVariance(kind, ytdBudget, ytdActual);
            rows.push({
                accountCode: code, accountName: account.name, kind,
                annualBudget: mb.reduce((a, v) => a + v, 0), ytdBudget, ytdActual, variance,
                variancePct: ytdBudget !== 0 ? Number(((variance / Math.abs(ytdBudget)) * 100).toFixed(1)) : null,
                monthlyBudget: mb, monthlyActual: ma,
            });
        }
        rows.sort((a, b) => (a.kind === b.kind ? a.accountCode.localeCompare(b.accountCode) : a.kind === 'REVENUE' ? -1 : 1));

        const sum = (kind: 'REVENUE' | 'EXPENSE', f: (r: BudgetVsActualRow) => number) => rows.filter((r) => r.kind === kind).reduce((a, r) => a + f(r), 0);
        const revenueBudget = sum('REVENUE', (r) => r.ytdBudget), revenueActual = sum('REVENUE', (r) => r.ytdActual);
        const expenseBudget = sum('EXPENSE', (r) => r.ytdBudget), expenseActual = sum('EXPENSE', (r) => r.ytdActual);

        return {
            fiscalYear, throughMonth, opmcId, rows,
            totals: { revenueBudget, revenueActual, expenseBudget, expenseActual, netBudget: revenueBudget - expenseBudget, netActual: revenueActual - expenseActual },
            hasBudget: budgets.length > 0,
        };
    }

    /**
     * Replace the 12 monthly budget lines of one account. Pass `annual` to spread evenly, or `monthly` (12 values).
     * Revenue and expense accounts only. Replaced atomically so an account never ends up with a partial year.
     */
    static async setAccountBudget(
        userId: string | null | undefined,
        input: { fiscalYear: number; accountCode: string; opmcId?: string | null; annual?: number; monthly?: number[]; note?: string },
    ) {
        const { opmcId } = await this.resolveTarget(userId, input.opmcId);
        const account = await prisma.chartOfAccount.findUnique({ where: { code: input.accountCode }, select: { type: true } });
        if (!account || (account.type !== 'REVENUE' && account.type !== 'EXPENSE')) {
            throw AppError.badRequest('Budgets can only be set on revenue or expense accounts');
        }
        if (opmcId) {
            const exists = await prisma.oPMC.findUnique({ where: { id: opmcId }, select: { id: true } });
            if (!exists) throw AppError.badRequest('Unknown OPMC');
        }
        const months = input.monthly ?? (input.annual !== undefined ? spreadAnnual(input.annual) : null);
        if (!months || months.length !== 12 || months.some((v) => !Number.isFinite(v) || v < 0)) {
            throw AppError.badRequest('Provide a non-negative annual amount or exactly 12 non-negative monthly amounts');
        }

        await prisma.$transaction([
            prisma.ledgerBudgetLine.deleteMany({ where: { fiscalYear: input.fiscalYear, accountCode: input.accountCode, opmcId } }),
            prisma.ledgerBudgetLine.createMany({
                data: months.map((amount, i) => ({
                    fiscalYear: input.fiscalYear, month: i + 1, accountCode: input.accountCode, opmcId, amount,
                    note: input.note ?? null, createdById: userId ?? null,
                })),
            }),
        ]);
        return { fiscalYear: input.fiscalYear, accountCode: input.accountCode, opmcId, monthly: months };
    }
}
