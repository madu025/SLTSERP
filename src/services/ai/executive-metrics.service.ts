import { prisma } from '@/lib/prisma';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { LedgerReportService } from '@/services/finance/ledger-report.service';
import { CompanyHealthService, monthBounds, type CompanyHealth, type Comparison } from '@/services/core/company-health.service';
import { swrMemo } from '@/lib/swr-memo';
import type { NexusCard, NexusTable } from '@/services/ai/nexus-agent.service';

/**
 * Numbers for the executive assistant, computed on our server (the external model never sees them).
 * Definitions match the dashboards: "completed" is a completed date in the period, the same-days rule
 * compares a half-finished month with the same number of days of the previous one.
 */
export type PeriodId = 'this_month' | 'last_month' | 'last_7_days' | 'last_30_days' | 'this_week' | 'this_year';
export type MetricId = 'completed_orders' | 'new_orders' | 'open_orders' | 'orders_revenue' | 'revenue' | 'expense' | 'net_profit';

export interface PeriodRange { label: string; from: Date; to: Date; prevLabel: string; prevFrom: Date; prevTo: Date }

const DAY_MS = 24 * 3600 * 1000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthLabel = (d: Date) => `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
const day = (d: Date) => d.toISOString().slice(0, 10);

export function resolvePeriod(period: string | undefined, now: Date = new Date()): PeriodRange {
    const b = monthBounds(now);
    switch (period) {
        case 'last_month': {
            const start = b.previousStart;
            const end = b.previousEnd;
            const prevStart = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - 1, 1));
            const prevEnd = new Date(start.getTime() - 1);
            return { label: monthLabel(start), from: start, to: end, prevLabel: monthLabel(prevStart), prevFrom: prevStart, prevTo: prevEnd };
        }
        case 'last_7_days':
        case 'last_30_days': {
            const days = period === 'last_7_days' ? 7 : 30;
            const from = new Date(now.getTime() - days * DAY_MS);
            const prevFrom = new Date(from.getTime() - days * DAY_MS);
            return { label: `last ${days} days`, from, to: now, prevLabel: `the ${days} days before`, prevFrom, prevTo: new Date(from.getTime() - 1) };
        }
        case 'this_week': {
            const dow = (now.getUTCDay() + 6) % 7; // Monday = 0
            const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - dow));
            const prevFrom = new Date(monday.getTime() - 7 * DAY_MS);
            return { label: `week of ${day(monday)}`, from: monday, to: now, prevLabel: 'same days of last week', prevFrom, prevTo: new Date(prevFrom.getTime() + (now.getTime() - monday.getTime())) };
        }
        case 'this_year': {
            const prevFrom = new Date(Date.UTC(now.getUTCFullYear() - 1, 0, 1));
            return { label: String(now.getUTCFullYear()), from: b.yearStart, to: now, prevLabel: `same days of ${now.getUTCFullYear() - 1}`, prevFrom, prevTo: new Date(prevFrom.getTime() + (now.getTime() - b.yearStart.getTime())) };
        }
        default:
            return { label: monthLabel(b.currentStart), from: b.currentStart, to: now, prevLabel: `same days of ${monthLabel(b.previousStart)}`, prevFrom: b.previousStart, prevTo: b.previousSameSpanEnd };
    }
}

interface Ctx { permissions: ReadonlySet<string>; opmcScope: readonly string[] | undefined }
type Range = { from: Date; to: Date };

interface MetricDef {
    id: MetricId;
    label: string;
    unit: 'count' | 'currency';
    higherIsBetter: boolean;
    permissions: string[];
    /** needs company-wide access (figures that cannot be limited to an OPMC) */
    companyWide: boolean;
    /** point in time: no period comparison */
    pointInTime?: boolean;
    total: (r: Range, c: Ctx) => Promise<number>;
    byRtom?: (r: Range, c: Ctx) => Promise<Map<string, number>>;
}

const scopeWhere = (c: Ctx) => (c.opmcScope === undefined ? {} : { opmcId: { in: [...c.opmcScope] } });
const OPEN = ['PENDING', 'INPROGRESS', 'ASSIGNED'] as const;

const METRICS: Record<MetricId, MetricDef> = {
    completed_orders: {
        id: 'completed_orders', label: 'Orders completed', unit: 'count', higherIsBetter: true, permissions: [RBAC_PERMISSIONS.SOD_READ], companyWide: false,
        total: (r, c) => prisma.serviceOrder.count({ where: { completedDate: { gte: r.from, lte: r.to }, ...scopeWhere(c) } }),
        byRtom: async (r, c) => {
            const rows = await prisma.serviceOrder.groupBy({ by: ['rtom'], where: { completedDate: { gte: r.from, lte: r.to }, ...scopeWhere(c) }, _count: { _all: true } });
            return new Map(rows.map((x) => [x.rtom, x._count._all]));
        },
    },
    new_orders: {
        id: 'new_orders', label: 'Orders received', unit: 'count', higherIsBetter: true, permissions: [RBAC_PERMISSIONS.SOD_READ], companyWide: false,
        total: (r, c) => prisma.serviceOrder.count({ where: { receivedDate: { gte: r.from, lte: r.to }, ...scopeWhere(c) } }),
        byRtom: async (r, c) => {
            const rows = await prisma.serviceOrder.groupBy({ by: ['rtom'], where: { receivedDate: { gte: r.from, lte: r.to }, ...scopeWhere(c) }, _count: { _all: true } });
            return new Map(rows.map((x) => [x.rtom, x._count._all]));
        },
    },
    open_orders: {
        id: 'open_orders', label: 'Open orders', unit: 'count', higherIsBetter: false, permissions: [RBAC_PERMISSIONS.SOD_READ], companyWide: false, pointInTime: true,
        total: (_r, c) => prisma.serviceOrder.count({ where: { status: { in: [...OPEN] }, ...scopeWhere(c) } }),
        byRtom: async (_r, c) => {
            const rows = await prisma.serviceOrder.groupBy({ by: ['rtom'], where: { status: { in: [...OPEN] }, ...scopeWhere(c) }, _count: { _all: true } });
            return new Map(rows.map((x) => [x.rtom, x._count._all]));
        },
    },
    orders_revenue: {
        id: 'orders_revenue', label: 'Revenue of completed orders', unit: 'currency', higherIsBetter: true, permissions: [RBAC_PERMISSIONS.SOD_READ, RBAC_PERMISSIONS.FINANCE_READ], companyWide: false,
        total: async (r, c) => Number((await prisma.serviceOrder.aggregate({ where: { completedDate: { gte: r.from, lte: r.to }, ...scopeWhere(c) }, _sum: { revenueAmount: true } }))._sum.revenueAmount ?? 0),
        byRtom: async (r, c) => {
            const rows = await prisma.serviceOrder.groupBy({ by: ['rtom'], where: { completedDate: { gte: r.from, lte: r.to }, ...scopeWhere(c) }, _sum: { revenueAmount: true } });
            return new Map(rows.map((x) => [x.rtom, Number(x._sum.revenueAmount ?? 0)]));
        },
    },
    revenue: { id: 'revenue', label: 'Revenue', unit: 'currency', higherIsBetter: true, permissions: [RBAC_PERMISSIONS.FINANCE_READ], companyWide: true, total: async (r) => (await LedgerReportService.getPnlReport(r.from, r.to)).totalRevenue },
    expense: { id: 'expense', label: 'Expense', unit: 'currency', higherIsBetter: false, permissions: [RBAC_PERMISSIONS.FINANCE_READ], companyWide: true, total: async (r) => (await LedgerReportService.getPnlReport(r.from, r.to)).totalExpense },
    net_profit: { id: 'net_profit', label: 'Net profit', unit: 'currency', higherIsBetter: true, permissions: [RBAC_PERMISSIONS.FINANCE_READ], companyWide: true, total: async (r) => (await LedgerReportService.getPnlReport(r.from, r.to)).netProfit },
};

export const METRIC_IDS = Object.keys(METRICS) as MetricId[];

export interface MetricComparison {
    metric: { id: MetricId; label: string; unit: 'count' | 'currency' };
    period: { label: string; from: string; to: string };
    compareTo: { label: string; from: string; to: string } | null;
    current: number;
    previous: number | null;
    change: number | null;
    changePct: number | null;
    good: boolean | null;
    rows?: { group: string; current: number; previous: number; change: number; changePct: number | null }[];
}

const fmtValue = (n: number, unit: 'count' | 'currency') =>
    unit === 'currency' ? `LKR ${new Intl.NumberFormat('en-LK', { notation: 'compact', maximumFractionDigits: 1 }).format(n)}` : n.toLocaleString('en-US');

const pctChange = (cur: number, prev: number) => (prev === 0 ? null : ((cur - prev) / Math.abs(prev)) * 100);
const goodOf = (change: number | null, higherIsBetter: boolean) => (change === null || Math.abs(change) < 1e-9 ? null : (change > 0) === higherIsBetter);

export class ExecutiveMetricService {
    static allowed(id: MetricId, permissions: ReadonlySet<string>, opmcScope: readonly string[] | undefined): { ok: true } | { ok: false; reason: string } {
        const m = METRICS[id];
        if (!m) return { ok: false, reason: `Unknown metric. Available: ${METRIC_IDS.join(', ')}.` };
        if (!m.permissions.every((p) => permissions.has(p))) return { ok: false, reason: `You do not have access to ${m.label.toLowerCase()}.` };
        if (m.companyWide && opmcScope !== undefined) return { ok: false, reason: `${m.label} is available to users with company-wide access.` };
        return { ok: true };
    }

    /** One number for a metric over a date range (used by projections). */
    static async value(id: MetricId, from: Date, to: Date, permissions: ReadonlySet<string>, opmcScope: readonly string[] | undefined): Promise<number | { error: string }> {
        const gate = this.allowed(id, permissions, opmcScope);
        if (!gate.ok) return { error: gate.reason };
        return METRICS[id].total({ from, to }, { permissions, opmcScope });
    }

    static async compare(
        id: MetricId, period: string | undefined, groupBy: string | undefined, permissions: ReadonlySet<string>, opmcScope: readonly string[] | undefined, now: Date = new Date(),
    ): Promise<MetricComparison | { error: string }> {
        const gate = this.allowed(id, permissions, opmcScope);
        if (!gate.ok) return { error: gate.reason };
        const m = METRICS[id];
        const ctx: Ctx = { permissions, opmcScope };
        const p = resolvePeriod(period, now);

        const [cur, prev] = m.pointInTime
            ? [await m.total(p, ctx), null]
            : await Promise.all([m.total({ from: p.from, to: p.to }, ctx), m.total({ from: p.prevFrom, to: p.prevTo }, ctx)]);
        const change = prev === null ? null : cur - prev;
        const out: MetricComparison = {
            metric: { id, label: m.label, unit: m.unit },
            period: { label: p.label, from: day(p.from), to: day(p.to) },
            compareTo: m.pointInTime ? null : { label: p.prevLabel, from: day(p.prevFrom), to: day(p.prevTo) },
            current: cur, previous: prev, change,
            changePct: prev === null ? null : pctChange(cur, prev),
            good: goodOf(change, m.higherIsBetter),
        };

        if (groupBy === 'rtom' && m.byRtom) {
            const [a, b] = await Promise.all([m.byRtom({ from: p.from, to: p.to }, ctx), m.pointInTime ? Promise.resolve(new Map<string, number>()) : m.byRtom({ from: p.prevFrom, to: p.prevTo }, ctx)]);
            const keys = new Set([...a.keys(), ...b.keys()]);
            out.rows = [...keys].map((g) => {
                const c1 = a.get(g) ?? 0;
                const c0 = b.get(g) ?? 0;
                return { group: g, current: c1, previous: c0, change: c1 - c0, changePct: pctChange(c1, c0) };
            }).sort((x, y) => Math.abs(y.change) - Math.abs(x.change) || y.current - x.current);
        }
        return out;
    }

    static card(res: MetricComparison): NexusCard {
        const delta = res.changePct === null ? (res.previous === null ? undefined : 'no base') : `${res.changePct > 0 ? '+' : ''}${res.changePct.toFixed(1)}%`;
        return {
            label: res.compareTo ? `${res.metric.label} · ${res.period.label}` : res.metric.label,
            value: fmtValue(res.current, res.metric.unit),
            delta,
            trend: res.change === null ? undefined : res.change > 0 ? 'up' : res.change < 0 ? 'down' : 'flat',
            good: res.good,
            caption: res.compareTo ? `vs ${res.compareTo.label}: ${fmtValue(res.previous ?? 0, res.metric.unit)}` : 'right now',
        };
    }

    static table(res: MetricComparison): NexusTable | undefined {
        if (!res.rows || res.rows.length === 0) return undefined;
        return {
            title: `${res.metric.label} by RTOM · ${res.period.label}${res.compareTo ? ` vs ${res.compareTo.label}` : ''}`,
            columns: ['RTOM', 'Current', 'Previous', 'Change', 'Change %'],
            rows: res.rows.slice(0, 50).map((r) => ({ RTOM: r.group, Current: r.current, Previous: r.previous, Change: r.change, 'Change %': r.changePct === null ? '-' : `${r.changePct.toFixed(1)}%` })),
            totalRows: res.rows.length,
            truncated: res.rows.length > 50,
            drill: { column: 'RTOM', template: 'Profile of RTOM {value}' },
        };
    }

    /** One-screen answer to "how is the company doing". Company-wide users get the health view, others their own OPMC scope. */
    static async brief(
        permissions: ReadonlySet<string>, opmcScope: readonly string[] | undefined, userId: string | undefined, now: Date = new Date(),
    ): Promise<{ cards: NexusCard[]; table?: NexusTable; asOf: string; scope: 'company' | 'opmc' } | { error: string }> {
        const cards: NexusCard[] = [];
        const asOf = now.toISOString();

        if (opmcScope === undefined && (permissions.has(RBAC_PERMISSIONS.REPORTS_MANAGER_READ) || permissions.has(RBAC_PERMISSIONS.ADMIN_RBAC))) {
            const key = `company-health:${userId ?? 'anon'}:${[...permissions].sort().join(',')}`;
            const h = await swrMemo<CompanyHealth>(key, 2 * 60_000, 15 * 60_000, () => CompanyHealthService.getCompanyHealth([...permissions], now, userId));
            const delta = (c: Comparison, higherIsBetter: boolean, unit: 'count' | 'currency', label: string, caption: string): NexusCard => {
                const ch = c.current - c.previous;
                return {
                    label, value: fmtValue(c.current, unit),
                    delta: c.changePct === null ? undefined : `${c.changePct > 0 ? '+' : ''}${c.changePct.toFixed(1)}%`,
                    trend: ch > 0 ? 'up' : ch < 0 ? 'down' : 'flat', good: goodOf(ch, higherIsBetter),
                    caption: `vs ${h.periods.previousLabel} same days${caption ? ' · ' + caption : ''}`,
                };
            };
            if (h.finance) {
                cards.push(delta(h.finance.revenue, true, 'currency', `Revenue · ${h.periods.currentLabel}`, ''));
                cards.push(delta(h.finance.netProfit, true, 'currency', 'Net profit', ''));
                cards.push({ label: 'Cash', value: fmtValue(h.finance.cashBalance, 'currency'), good: h.finance.cashBalance < 0 ? false : null, caption: 'bank and petty cash' });
                cards.push({ label: 'Receivables', value: fmtValue(h.finance.receivables.total, 'currency'), good: h.finance.receivables.over90 > 0 ? false : null, caption: `${fmtValue(h.finance.receivables.over90, 'currency')} over 90 days` });
            }
            if (h.operations) {
                cards.push(delta(h.operations.completed, true, 'count', `Orders completed · ${h.periods.currentLabel}`, ''));
                cards.push({ label: 'Open orders', value: h.operations.openOrders.toLocaleString('en-US'), good: h.operations.agedOver30Days > 0 ? false : null, caption: `${h.operations.agedOver30Days.toLocaleString('en-US')} open over 30 days` });
            }
            if (h.projects) cards.push({ label: 'Active projects', value: String(h.projects.active), good: h.projects.overdue + h.projects.overBudget > 0 ? false : null, caption: `${h.projects.overdue} late, ${h.projects.overBudget} over budget` });
            const top = h.exceptions.slice(0, 6);
            const table: NexusTable | undefined = top.length ? {
                title: `Needs attention (${h.exceptions.length} items)`,
                columns: ['Severity', 'Area', 'Issue', 'Detail'],
                rows: top.map((e) => ({ Severity: e.severity, Area: e.area, Issue: e.title, Detail: e.detail })),
                totalRows: h.exceptions.length, truncated: h.exceptions.length > top.length,
            } : undefined;
            return { cards, table, asOf: h.asOf, scope: 'company' };
        }

        if (!permissions.has(RBAC_PERMISSIONS.SOD_READ)) return { error: 'The executive brief needs access to company reports or to service orders.' };
        const ids: MetricId[] = ['completed_orders', 'new_orders', 'open_orders'];
        for (const id of ids) {
            const r = await this.compare(id, 'this_month', undefined, permissions, opmcScope, now);
            if (!('error' in r)) cards.push(this.card(r));
        }
        return { cards, asOf, scope: 'opmc' };
    }
}
