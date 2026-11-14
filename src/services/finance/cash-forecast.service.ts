import { prisma } from '@/lib/prisma';
import { resolveOpmcScope } from '@/lib/opmc-scope';
import { LedgerReportService } from './ledger-report.service';

const DAY = 24 * 3600 * 1000;
const WEEK = 7 * DAY;

/** Default payment terms used when a document has no due date. Stated on the report, never hidden. */
export const DEFAULT_CLIENT_TERMS_DAYS = 30;
export const DEFAULT_PAYABLE_TERMS_DAYS = 30;

/** Indicative expected-credit-loss rates by receivable age. A provisioning estimate, not an accounting entry. */
export const ECL_RATES = { current: 0.005, days31to60: 0.02, days61to90: 0.1, over90: 0.35 } as const;

export interface ForecastWeek {
    week: number;
    start: string;
    inflow: number;
    outflow: number;
    net: number;
    closingCash: number | null;
}

export interface CashForecast {
    asOf: string;
    horizonWeeks: number;
    /** Opening cash is a company-wide ledger figure, so it is withheld from OPMC-scoped users. */
    openingCash: number | null;
    weeks: ForecastWeek[];
    /** Receivables already past their due date: not assumed collected in any week. */
    overdueReceivables: number;
    /** Payables already past their due date: shown as a week-1 outflow. */
    overduePayables: number;
    monthlyPayrollEstimate: number;
    lowestProjectedCash: { week: number; amount: number } | null;
    assumptions: string[];
}

export interface ReceivablesRisk {
    asOf: string;
    totalReceivables: number;
    overdueTotal: number;
    overduePct: number | null;
    over90: number;
    /** Days sales outstanding: receivables / revenue billed in the last 90 days x 90. */
    dso: number | null;
    billedLast90Days: number;
    topExposures: { projectId: string; name: string; balance: number; sharePct: number }[];
    top5SharePct: number | null;
    expectedCreditLoss: number;
    eclRates: typeof ECL_RATES;
    invoiceCount: number;
}

export function weekIndex(date: Date, now: Date): number {
    // 1-based week from today; anything due in the past is overdue (index 0)
    const diff = date.getTime() - now.getTime();
    return diff < 0 ? 0 : Math.floor(diff / WEEK) + 1;
}

export function expectedCreditLoss(buckets: { current: number; days31to60: number; days61to90: number; over90: number }): number {
    return buckets.current * ECL_RATES.current + buckets.days31to60 * ECL_RATES.days31to60
        + buckets.days61to90 * ECL_RATES.days61to90 + buckets.over90 * ECL_RATES.over90;
}

export function computeDso(receivables: number, billedLast90Days: number): number | null {
    return billedLast90Days > 0 ? (receivables / billedLast90Days) * 90 : null;
}

export class CashForecastService {
    static async getForecast(userId: string | null | undefined, horizonWeeks = 13, now = new Date()): Promise<CashForecast> {
        const scope = await resolveOpmcScope(userId);
        const projectScope = scope === undefined ? {} : { project: { opmcId: { in: scope } } };

        const [receivables, payables, payrollRows, cash] = await Promise.all([
            prisma.projectInvoice.findMany({
                // Only invoices that have been issued: drafts are not receivables yet.
                where: { ...projectScope, type: 'CLIENT', status: { notIn: ['DRAFT', 'CANCELLED', 'REJECTED'] }, balanceAmount: { gt: 0 }, paymentStatus: { in: ['NOT_DUE', 'PENDING', 'PARTIALLY_PAID', 'OVERDUE'] } },
                select: { balanceAmount: true, dueDate: true, invoiceDate: true },
            }),
            prisma.invoice.findMany({
                where: { ...projectScope, status: { in: ['PENDING', 'APPROVED', 'HOLD'] } },
                select: { totalAmount: true, amount: true, date: true },
            }),
            prisma.payrollExpense.findMany({
                where: { status: 'POSTED', ...(scope === undefined ? {} : { opmcId: { in: scope } }) },
                select: { period: true, amount: true },
                orderBy: { createdAt: 'desc' },
                take: 300,
            }),
            scope === undefined ? LedgerReportService.getCashFlowReport(undefined, now) : Promise.resolve(null),
        ]);

        const inflow = new Array<number>(horizonWeeks + 1).fill(0);
        const outflow = new Array<number>(horizonWeeks + 1).fill(0);
        let overdueReceivables = 0;
        let overduePayables = 0;

        for (const inv of receivables) {
            const due = inv.dueDate ?? new Date(new Date(inv.invoiceDate).getTime() + DEFAULT_CLIENT_TERMS_DAYS * DAY);
            const w = weekIndex(due, now);
            const amount = Number(inv.balanceAmount);
            if (w === 0) overdueReceivables += amount;
            else if (w <= horizonWeeks) inflow[w] += amount;
        }
        for (const inv of payables) {
            const due = new Date(new Date(inv.date).getTime() + DEFAULT_PAYABLE_TERMS_DAYS * DAY);
            const w = weekIndex(due, now);
            const amount = Number(inv.totalAmount || inv.amount || 0);
            if (w === 0) { overduePayables += amount; outflow[1] += amount; }
            else if (w <= horizonWeeks) outflow[w] += amount;
        }

        // Payroll: average of the latest three posted periods, assumed paid at each month end.
        const byPeriod = new Map<string, number>();
        for (const p of payrollRows) byPeriod.set(p.period, (byPeriod.get(p.period) ?? 0) + Number(p.amount));
        const latest = [...byPeriod.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)).slice(0, 3);
        const monthlyPayroll = latest.length ? latest.reduce((a, [, v]) => a + v, 0) / latest.length : 0;
        if (monthlyPayroll > 0) {
            for (let m = 0; m < 4; m++) {
                const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + m + 1, 0, 23, 59, 59));
                const w = weekIndex(monthEnd, now);
                if (w >= 1 && w <= horizonWeeks) outflow[w] += monthlyPayroll;
            }
        }

        const openingCash = cash ? cash.closingCash : null;
        let running = openingCash;
        let lowest: CashForecast['lowestProjectedCash'] = null;
        const weeks: ForecastWeek[] = [];
        for (let w = 1; w <= horizonWeeks; w++) {
            const net = inflow[w] - outflow[w];
            if (running !== null) running += net;
            if (running !== null && (lowest === null || running < lowest.amount)) lowest = { week: w, amount: running };
            weeks.push({
                week: w, start: new Date(now.getTime() + (w - 1) * WEEK).toISOString().slice(0, 10),
                inflow: inflow[w], outflow: outflow[w], net, closingCash: running,
            });
        }

        return {
            asOf: now.toISOString(), horizonWeeks, openingCash, weeks, overdueReceivables, overduePayables,
            monthlyPayrollEstimate: monthlyPayroll, lowestProjectedCash: lowest,
            assumptions: [
                `Client invoices without a due date are assumed due ${DEFAULT_CLIENT_TERMS_DAYS} days after the invoice date; contractor invoices ${DEFAULT_PAYABLE_TERMS_DAYS} days after their date.`,
                'Receivables already past due are not assumed collected in any week; they are shown separately as overdue.',
                'Payables already past due are shown as paid in week 1.',
                'Payroll is the average of the latest three posted periods, paid at each month end.',
                'Retention releases, tax remittances and capex are not included.',
                ...(openingCash === null ? ['Opening cash and projected balance are hidden because the ledger is company-wide and your access is scoped to specific OPMCs.'] : []),
            ],
        };
    }

    static async getReceivablesRisk(userId: string | null | undefined, now = new Date()): Promise<ReceivablesRisk> {
        const scope = await resolveOpmcScope(userId);
        const projectScope = scope === undefined ? {} : { project: { opmcId: { in: scope } } };
        const since = new Date(now.getTime() - 90 * DAY);

        const [open, billed] = await Promise.all([
            prisma.projectInvoice.findMany({
                where: { ...projectScope, type: 'CLIENT', status: { notIn: ['DRAFT', 'CANCELLED', 'REJECTED'] }, balanceAmount: { gt: 0 }, paymentStatus: { in: ['NOT_DUE', 'PENDING', 'PARTIALLY_PAID', 'OVERDUE'] } },
                select: { balanceAmount: true, invoiceDate: true, dueDate: true, projectId: true, project: { select: { name: true } } },
            }),
            prisma.projectInvoice.aggregate({
                where: { ...projectScope, type: 'CLIENT', status: { notIn: ['DRAFT', 'CANCELLED', 'REJECTED'] }, invoiceDate: { gte: since, lte: now } },
                _sum: { totalAmount: true },
            }),
        ]);

        const buckets = { current: 0, days31to60: 0, days61to90: 0, over90: 0 };
        let total = 0, overdue = 0;
        const byProject = new Map<string, { name: string; balance: number }>();
        for (const inv of open) {
            const balance = Number(inv.balanceAmount);
            const age = Math.floor((now.getTime() - new Date(inv.invoiceDate).getTime()) / DAY);
            total += balance;
            if (age <= 30) buckets.current += balance; else if (age <= 60) buckets.days31to60 += balance; else if (age <= 90) buckets.days61to90 += balance; else buckets.over90 += balance;
            const due = inv.dueDate ?? new Date(new Date(inv.invoiceDate).getTime() + DEFAULT_CLIENT_TERMS_DAYS * DAY);
            if (due < now) overdue += balance;
            const key = inv.projectId ?? 'GENERAL';
            const row = byProject.get(key) ?? { name: inv.project?.name ?? 'General client / SLT', balance: 0 };
            row.balance += balance;
            byProject.set(key, row);
        }

        const topExposures = [...byProject.entries()]
            .map(([projectId, v]) => ({ projectId, name: v.name, balance: v.balance, sharePct: total > 0 ? Number(((v.balance / total) * 100).toFixed(1)) : 0 }))
            .sort((a, b) => b.balance - a.balance).slice(0, 5);
        const billedLast90 = Number(billed._sum.totalAmount ?? 0);

        return {
            asOf: now.toISOString(), totalReceivables: total, overdueTotal: overdue,
            overduePct: total > 0 ? Number(((overdue / total) * 100).toFixed(1)) : null,
            over90: buckets.over90, dso: (() => { const d = computeDso(total, billedLast90); return d === null ? null : Number(d.toFixed(1)); })(),
            billedLast90Days: billedLast90, topExposures,
            top5SharePct: total > 0 ? Number(topExposures.reduce((a, e) => a + e.sharePct, 0).toFixed(1)) : null,
            expectedCreditLoss: expectedCreditLoss(buckets), eclRates: ECL_RATES, invoiceCount: open.length,
        };
    }
}
