import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { LedgerReportService } from '@/services/finance/ledger-report.service';
import { swrMemo } from '@/lib/swr-memo';
import { groundValue, listRtoms } from '@/services/ai/semantic-layer.service';
import { ExecutiveMetricService, resolvePeriod, type MetricId } from '@/services/ai/executive-metrics.service';
import type { NexusCard, NexusTable } from '@/services/ai/nexus-agent.service';

/**
 * Anomalies, projections and profiles for the executive assistant (items 4 to 7).
 * All figures are computed on our server; the external model never sees them.
 */
const DAY_MS = 24 * 3600 * 1000;
const OPEN = ['PENDING', 'INPROGRESS', 'ASSIGNED'] as const;
const day = (d: Date) => d.toISOString().slice(0, 10);
const n0 = (n: number) => Math.round(n).toLocaleString('en-US');
type Scope = readonly string[] | undefined;
const scopeWhere = (s: Scope) => (s === undefined ? {} : { opmcId: { in: [...s] } });

// ---------- pure functions (unit tested) ----------

export interface Finding { severity: 'critical' | 'warning' | 'info'; area: string; finding: string; evidence: string }

const mean = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0);
const std = (v: number[]) => { const m = mean(v); return Math.sqrt(mean(v.map((x) => (x - m) ** 2))); };

/** Days in `recent` that sit far outside the pattern of the `baseline` days before them. */
export function detectSeriesAnomalies(values: number[], recentLen = 14, minZ = 2.5): { index: number; value: number; expected: number; z: number }[] {
    if (values.length <= recentLen + 7) return [];
    const baseline = values.slice(0, values.length - recentLen);
    const m = mean(baseline);
    const s = std(baseline) || 1;
    const out: { index: number; value: number; expected: number; z: number }[] = [];
    for (let i = values.length - recentLen; i < values.length; i++) {
        const z = (values[i] - m) / s;
        // a real anomaly is both statistically and practically large
        if (Math.abs(z) >= minZ && Math.abs(values[i] - m) >= Math.max(5, 0.2 * m)) out.push({ index: i, value: values[i], expected: m, z });
    }
    return out;
}

export function detectRtomDrops(rows: { rtom: string; recent: number; priorWeeklyAvg: number }[], minPrior = 20, minDrop = 0.4) {
    return rows.filter((r) => r.priorWeeklyAvg >= minPrior && r.recent <= r.priorWeeklyAvg * (1 - minDrop))
        .map((r) => ({ ...r, dropPct: (1 - r.recent / r.priorWeeklyAvg) * 100 }))
        .sort((a, b) => b.dropPct - a.dropPct);
}

export function detectBacklog(rows: { rtom: string; open: number; over14: number }[]) {
    const sorted = rows.map((r) => r.over14).sort((a, b) => a - b);
    const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
    return rows.filter((r) => r.over14 >= Math.max(10, 2 * median) && r.over14 >= 0.4 * r.open)
        .sort((a, b) => b.over14 - a.over14);
}

export function projectMonthEnd(mtd: number, elapsedDays: number, daysInMonth: number): number {
    if (elapsedDays <= 0) return mtd;
    return (mtd / elapsedDays) * daysInMonth;
}

/** Mean absolute percentage error of past projections; null when there is nothing to compare. */
export function backtestError(history: { projected: number; actual: number }[]): number | null {
    const usable = history.filter((h) => h.actual > 0);
    if (usable.length === 0) return null;
    return mean(usable.map((h) => Math.abs(h.projected - h.actual) / h.actual)) * 100;
}

// ---------- database parts ----------

async function dailyCompleted(scope: Scope, from: Date, to: Date): Promise<number[]> {
    const rows = scope === undefined
        ? await prisma.$queryRaw<{ d: Date; n: bigint }[]>(Prisma.sql`SELECT date_trunc('day', "completedDate" AT TIME ZONE 'UTC') AS d, count(*) AS n FROM "ServiceOrder" WHERE "completedDate" >= ${from} AND "completedDate" <= ${to} GROUP BY 1`)
        : await prisma.$queryRaw<{ d: Date; n: bigint }[]>(Prisma.sql`SELECT date_trunc('day', "completedDate" AT TIME ZONE 'UTC') AS d, count(*) AS n FROM "ServiceOrder" WHERE "completedDate" >= ${from} AND "completedDate" <= ${to} AND "opmcId"::text = ANY(${[...scope]}::text[]) GROUP BY 1`);
    const byDay = new Map(rows.map((r) => [day(new Date(r.d)), Number(r.n)]));
    const out: number[] = [];
    for (let t = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()); t <= to.getTime(); t += DAY_MS) out.push(byDay.get(day(new Date(t))) ?? 0);
    return out;
}

export class ExecutiveInsightService {
    /** Item 4: anything unusual right now, from fixed rules plus statistics. */
    static async anomalies(permissions: ReadonlySet<string>, scope: Scope, now: Date = new Date()): Promise<{ summary: string; cards: NexusCard[]; table?: NexusTable } | { error: string }> {
        if (!permissions.has(RBAC_PERMISSIONS.SOD_READ) && !permissions.has(RBAC_PERMISSIONS.FINANCE_READ)) return { error: 'Anomaly checks need access to service orders or finance.' };
        const findings: Finding[] = [];
        const key = `exec-anomalies:${[...permissions].sort().join(',')}:${scope ? [...scope].sort().join(',') : 'all'}`;
        const cached = await swrMemo<Finding[]>(key, 5 * 60_000, 30 * 60_000, async () => {
            const out: Finding[] = [];
            if (permissions.has(RBAC_PERMISSIONS.SOD_READ)) {
                const from = new Date(now.getTime() - 42 * DAY_MS);
                const series = await dailyCompleted(scope, from, now);
                // today is incomplete, so judge complete days only
                const complete = series.slice(0, -1);
                for (const a of detectSeriesAnomalies(complete)) {
                    const when = day(new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate() + a.index)));
                    out.push({
                        severity: a.value < a.expected ? 'warning' : 'info', area: 'Operations',
                        finding: a.value < a.expected ? `Completions dropped on ${when}` : `Completions spiked on ${when}`,
                        evidence: `${n0(a.value)} completed against a usual ${n0(a.expected)} a day (${a.z.toFixed(1)} standard deviations)`,
                    });
                }
                const weekStart = new Date(now.getTime() - 7 * DAY_MS);
                const priorStart = new Date(weekStart.getTime() - 28 * DAY_MS);
                const [recent, prior, open, old] = await Promise.all([
                    prisma.serviceOrder.groupBy({ by: ['rtom'], where: { completedDate: { gte: weekStart, lte: now }, ...scopeWhere(scope) }, _count: { _all: true } }),
                    prisma.serviceOrder.groupBy({ by: ['rtom'], where: { completedDate: { gte: priorStart, lt: weekStart }, ...scopeWhere(scope) }, _count: { _all: true } }),
                    prisma.serviceOrder.groupBy({ by: ['rtom'], where: { status: { in: [...OPEN] }, ...scopeWhere(scope) }, _count: { _all: true } }),
                    prisma.serviceOrder.groupBy({ by: ['rtom'], where: { status: { in: [...OPEN] }, receivedDate: { lt: new Date(now.getTime() - 14 * DAY_MS) }, ...scopeWhere(scope) }, _count: { _all: true } }),
                ]);
                const recentMap = new Map(recent.map((r) => [r.rtom, r._count._all]));
                const drops = detectRtomDrops(prior.map((p) => ({ rtom: p.rtom, recent: recentMap.get(p.rtom) ?? 0, priorWeeklyAvg: p._count._all / 4 })));
                for (const d of drops.slice(0, 5)) {
                    out.push({ severity: d.dropPct >= 60 ? 'critical' : 'warning', area: `RTOM ${d.rtom}`, finding: 'Weekly completions fell sharply', evidence: `${n0(d.recent)} in the last 7 days against a usual ${n0(d.priorWeeklyAvg)} a week (down ${d.dropPct.toFixed(0)}%)` });
                }
                const openMap = new Map(open.map((r) => [r.rtom, r._count._all]));
                const backlog = detectBacklog(old.map((o) => ({ rtom: o.rtom, open: openMap.get(o.rtom) ?? o._count._all, over14: o._count._all })));
                for (const b of backlog.slice(0, 5)) {
                    out.push({ severity: b.over14 >= 50 ? 'critical' : 'warning', area: `RTOM ${b.rtom}`, finding: 'Old open orders are piling up', evidence: `${n0(b.over14)} of ${n0(b.open)} open orders are older than 14 days` });
                }
            }
            if (permissions.has(RBAC_PERMISSIONS.FINANCE_READ) && scope === undefined) {
                const exp = await Promise.all([
                    LedgerReportService.getPnlReport(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)), now),
                    ...[1, 2, 3].map((i) => LedgerReportService.getPnlReport(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1)), new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i + 1, 1) - 1))),
                ]);
                const elapsed = Math.max(1, (now.getTime() - Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)) / DAY_MS);
                const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
                const projected = projectMonthEnd(exp[0].totalExpense, elapsed, daysInMonth);
                const prior = mean([exp[1].totalExpense, exp[2].totalExpense, exp[3].totalExpense]);
                // only meaningful when each of the three earlier months has real expense data
                if ([exp[1], exp[2], exp[3]].every((x) => x.totalExpense > 0) && projected > prior * 1.3 && elapsed >= 7) {
                    out.push({ severity: 'warning', area: 'Finance', finding: 'Expenses are running above the recent pattern', evidence: `On track for LKR ${n0(projected)} this month against an average of LKR ${n0(prior)} over the last 3 months (+${(((projected - prior) / prior) * 100).toFixed(0)}%)` });
                }
                if (exp[0].netProfit < 0 && elapsed >= 7) {
                    out.push({ severity: 'critical', area: 'Finance', finding: 'Loss-making month so far', evidence: `Net result LKR ${n0(exp[0].netProfit)} after ${elapsed.toFixed(0)} days` });
                }
            }
            return out;
        });
        findings.push(...cached);
        const rank = { critical: 0, warning: 1, info: 2 } as const;
        findings.sort((a, b) => rank[a.severity] - rank[b.severity]);
        const crit = findings.filter((f) => f.severity === 'critical').length;
        const warn = findings.filter((f) => f.severity === 'warning').length;
        return {
            summary: findings.length === 0 ? 'Nothing unusual found against the recent pattern.' : `${findings.length} unusual item(s) found: ${crit} critical, ${warn} warning. Rules: daily completions against the last 6 weeks, weekly drops per RTOM, old open orders per RTOM, expense run-rate.`,
            cards: [
                { label: 'Critical', value: String(crit), good: crit > 0 ? false : null, caption: 'needs action now' },
                { label: 'Warnings', value: String(warn), good: warn > 0 ? false : null, caption: 'worth a look' },
            ],
            table: findings.length === 0 ? undefined : {
                title: `Unusual items · as of ${day(now)}`,
                columns: ['Severity', 'Area', 'Finding', 'Evidence'],
                rows: findings.slice(0, 50).map((f) => ({ Severity: f.severity, Area: f.area, Finding: f.finding, Evidence: f.evidence })),
                totalRows: findings.length, truncated: findings.length > 50,
                drill: { column: 'Area', template: 'Profile of {value}' },
            },
        };
    }

    /** Item 5: month-end projection, with the error of the same method on past months. */
    static async project(metric: MetricId, permissions: ReadonlySet<string>, scope: Scope, now: Date = new Date()): Promise<{ summary: string; cards: NexusCard[] } | { error: string }> {
        const gate = ExecutiveMetricService.allowed(metric, permissions, scope);
        if (!gate.ok) return { error: gate.reason };
        if (metric === 'open_orders') return { error: 'Open orders is a point-in-time figure; projection applies to completed orders, received orders, revenue, expense and profit.' };
        const y = now.getUTCFullYear();
        const m = now.getUTCMonth();
        const monthStart = new Date(Date.UTC(y, m, 1));
        const elapsedMs = now.getTime() - monthStart.getTime();
        const elapsedDays = Math.max(1, elapsedMs / DAY_MS);
        const daysInMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
        const get = async (from: Date, to: Date) => {
            const v = await ExecutiveMetricService.value(metric, from, to, permissions, scope);
            if (typeof v !== 'number') throw new Error(v.error);
            return v;
        };
        const mtd = await get(monthStart, now);
        const projection = projectMonthEnd(mtd, elapsedDays, daysInMonth);
        const hist: { projected: number; actual: number }[] = [];
        let lastActual = 0;
        for (let i = 1; i <= 3; i++) {
            const s = new Date(Date.UTC(y, m - i, 1));
            const e = new Date(Date.UTC(y, m - i + 1, 1) - 1);
            const dim = new Date(Date.UTC(y, m - i + 1, 0)).getUTCDate();
            const [atSameDay, actual] = await Promise.all([get(s, new Date(Math.min(e.getTime(), s.getTime() + elapsedMs))), get(s, e)]);
            hist.push({ projected: projectMonthEnd(atSameDay, elapsedDays, dim), actual });
            if (i === 1) lastActual = actual;
        }
        const err = backtestError(hist);
        const label = ({ completed_orders: 'Orders completed', new_orders: 'Orders received', orders_revenue: 'Revenue of completed orders', revenue: 'Revenue', expense: 'Expense', net_profit: 'Net profit' } as Record<string, string>)[metric] ?? metric;
        const money = ['orders_revenue', 'revenue', 'expense', 'net_profit'].includes(metric);
        const fmt = (v: number) => (money ? `LKR ${new Intl.NumberFormat('en-LK', { notation: 'compact', maximumFractionDigits: 1 }).format(v)}` : n0(v));
        const change = lastActual === 0 ? null : ((projection - lastActual) / Math.abs(lastActual)) * 100;
        const higherBetter = metric !== 'expense';
        return {
            summary: `${label}: projection for the end of the month, from the pace of the first ${elapsedDays.toFixed(1)} days. This is a projection, not a forecast of events; ${err === null ? 'there is no earlier month to test the method against.' : `the same method was off by ${err.toFixed(0)}% on average over the last 3 months.`}`,
            cards: [
                { label: `${label} · so far`, value: fmt(mtd), caption: `${elapsedDays.toFixed(1)} of ${daysInMonth} days` },
                { label: `${label} · month-end projection`, value: fmt(projection), delta: change === null ? undefined : `${change > 0 ? '+' : ''}${change.toFixed(1)}%`, trend: change === null ? undefined : change > 0 ? 'up' : change < 0 ? 'down' : 'flat', good: change === null || change === 0 ? null : (change > 0) === higherBetter, caption: `vs last month's actual ${fmt(lastActual)}` },
                { label: 'Method accuracy', value: err === null ? 'n/a' : `±${err.toFixed(0)}%`, caption: 'average miss over the last 3 months' },
            ],
        };
    }

    /** Items 6 and 7: one RTOM or one contractor across modules. */
    static async profile(type: string, name: string, permissions: ReadonlySet<string>, scope: Scope, now: Date = new Date()): Promise<{ summary: string; cards: NexusCard[]; table?: NexusTable } | { error: string }> {
        if (!permissions.has(RBAC_PERMISSIONS.SOD_READ)) return { error: 'Profiles need access to service orders.' };
        const p = resolvePeriod('this_month', now);
        const clean = name.trim();
        if (!clean) return { error: 'Tell me which RTOM or contractor.' };

        if (type === 'rtom') {
            const typed = clean.replace(/^rtom\s+/i, '');
            const g = groundValue(typed, await listRtoms(scope));
            if (g.kind === 'ambiguous') return { error: `"${typed}" matches several RTOMs: ${g.options.join(', ')}. Which one do you mean?` };
            if (g.kind === 'none') return { error: `There is no RTOM "${typed}" in the data you can see.${g.suggestions.length ? ` Closest: ${g.suggestions.join(', ')}.` : ''}` };
            const rtom = g.value;
            const base = { rtom, ...scopeWhere(scope) };
            const [cur, prev, open, old, rev, byContractor, byStatusR] = await Promise.all([
                prisma.serviceOrder.count({ where: { ...base, completedDate: { gte: p.from, lte: p.to } } }),
                prisma.serviceOrder.count({ where: { ...base, completedDate: { gte: p.prevFrom, lte: p.prevTo } } }),
                prisma.serviceOrder.count({ where: { ...base, status: { in: [...OPEN] } } }),
                prisma.serviceOrder.count({ where: { ...base, status: { in: [...OPEN] }, receivedDate: { lt: new Date(now.getTime() - 14 * DAY_MS) } } }),
                permissions.has(RBAC_PERMISSIONS.FINANCE_READ) ? prisma.serviceOrder.aggregate({ where: { ...base, completedDate: { gte: p.from, lte: p.to } }, _sum: { revenueAmount: true } }) : Promise.resolve(null),
                prisma.serviceOrder.groupBy({ by: ['contractorId'], where: { ...base, completedDate: { gte: p.from, lte: p.to }, contractorId: { not: null } }, _count: { _all: true } }),
                prisma.serviceOrder.groupBy({ by: ['status'], where: { ...base, completedDate: { gte: p.from, lte: p.to } }, _count: { _all: true } }),
            ]);
            if (cur + prev + open === 0) return { error: `No service orders found for RTOM ${rtom} within your access.` };
            const ids = byContractor.map((c) => c.contractorId!).filter(Boolean);
            const names = ids.length ? await prisma.contractor.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }) : [];
            const nameOf = new Map(names.map((c) => [c.id, c.name]));
            const pct = prev === 0 ? null : ((cur - prev) / prev) * 100;
            const cards: NexusCard[] = [
                { label: `Completed · ${p.label}`, value: n0(cur), delta: pct === null ? undefined : `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`, trend: pct === null ? undefined : pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat', good: pct === null || pct === 0 ? null : pct > 0, caption: `vs ${p.prevLabel}: ${n0(prev)}` },
                { label: 'Open orders', value: n0(open), good: old > 0 ? false : null, caption: `${n0(old)} older than 14 days` },
            ];
            if (rev) cards.push({ label: 'Revenue of completed orders', value: `LKR ${new Intl.NumberFormat('en-LK', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(rev._sum.revenueAmount ?? 0))}`, caption: p.label });
            return {
                summary: `Profile of RTOM ${rtom}, ${p.label} against ${p.prevLabel}.`,
                cards,
                table: byContractor.length ? {
                    title: `Contractors in ${rtom} · completed ${p.label}`,
                    columns: ['Contractor', 'Completed'],
                    rows: byContractor.sort((a, b) => b._count._all - a._count._all).slice(0, 30).map((c) => ({ Contractor: nameOf.get(c.contractorId!) ?? 'Unknown', Completed: c._count._all })),
                    totalRows: byContractor.length, truncated: byContractor.length > 30,
                    drill: { column: 'Contractor', template: 'Profile of contractor {value}' },
                } : byStatusR.length ? {
                    title: `${rtom} · completed ${p.label} by status`,
                    columns: ['Status', 'Orders'],
                    rows: byStatusR.sort((a, b) => b._count._all - a._count._all).map((x) => ({ Status: x.status, Orders: x._count._all })),
                    totalRows: byStatusR.length, truncated: false,
                } : undefined,
            };
        }

        // contractor
        const cname = clean.replace(/^contractor\s+/i, '');
        const matches = await prisma.contractor.findMany({ where: { name: { contains: cname, mode: 'insensitive' }, ...scopeWhere(scope) }, select: { id: true, name: true }, take: 6 });
        if (matches.length === 0) return { error: `No contractor matching "${cname}" within your access.` };
        const exact = matches.find((c) => c.name.toLowerCase() === cname.toLowerCase());
        if (matches.length > 1 && !exact) return { error: `Several contractors match "${cname}": ${matches.map((c) => c.name).join(', ')}. Ask again with the full name.` };
        const c = exact ?? matches[0];
        const base = { contractorId: c.id, ...scopeWhere(scope) };
        const canStock = permissions.has(RBAC_PERMISSIONS.INVENTORY_READ);
        const [cur, prev, open, byStatus, stock, wastage] = await Promise.all([
            prisma.serviceOrder.count({ where: { ...base, completedDate: { gte: p.from, lte: p.to } } }),
            prisma.serviceOrder.count({ where: { ...base, completedDate: { gte: p.prevFrom, lte: p.prevTo } } }),
            prisma.serviceOrder.count({ where: { ...base, status: { in: [...OPEN] } } }),
            prisma.serviceOrder.groupBy({ by: ['status'], where: { ...base, completedDate: { gte: p.from, lte: p.to } }, _count: { _all: true } }),
            canStock ? prisma.contractorStock.findMany({ where: { contractorId: c.id, quantity: { gt: 0 } }, select: { quantity: true, item: { select: { name: true } } }, orderBy: { quantity: 'desc' }, take: 200 }) : Promise.resolve(null),
            canStock ? prisma.contractorWastage.count({ where: { contractorId: c.id } }) : Promise.resolve(null),
        ]);
        const pct = prev === 0 ? null : ((cur - prev) / prev) * 100;
        const cards: NexusCard[] = [
            { label: `Completed · ${p.label}`, value: n0(cur), delta: pct === null ? undefined : `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`, trend: pct === null ? undefined : pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat', good: pct === null || pct === 0 ? null : pct > 0, caption: `vs ${p.prevLabel}: ${n0(prev)}` },
            { label: 'Open orders', value: n0(open) },
        ];
        if (stock) cards.push({ label: 'Stock held', value: `${stock.length} items`, caption: `${n0(stock.reduce((a, s) => a + Number(s.quantity), 0))} units in total` });
        if (wastage !== null) cards.push({ label: 'Wastage records', value: n0(wastage) });
        return {
            summary: `Profile of contractor ${c.name}, ${p.label} against ${p.prevLabel}.`,
            cards,
            table: stock && stock.length ? {
                title: `${c.name} · stock held (largest first)`,
                columns: ['Item', 'Quantity'],
                rows: stock.slice(0, 20).map((s) => ({ Item: s.item.name, Quantity: Number(s.quantity) })),
                totalRows: stock.length, truncated: stock.length > 20,
            } : byStatus.length ? {
                title: `${c.name} · completed orders by status`,
                columns: ['Status', 'Orders'],
                rows: byStatus.map((s) => ({ Status: s.status, Orders: s._count._all })),
                totalRows: byStatus.length, truncated: false,
            } : undefined,
        };
    }
}
