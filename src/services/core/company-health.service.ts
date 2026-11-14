import { prisma } from '@/lib/prisma';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { LedgerReportService } from '@/services/finance/ledger-report.service';
import { ArApService } from '@/services/finance/ar-ap.service';

/**
 * One-page company health for management (CEO / GM).
 *
 * Every section is optional: it is only computed when the caller holds the capability that
 * guards that module's own pages, so this view can never reveal more than the module screens do.
 * Figures are company-wide (the endpoint itself requires a management-level capability).
 */

export type Severity = 'critical' | 'warning' | 'info';

export interface HealthException {
    id: string;
    severity: Severity;
    area: 'Finance' | 'Operations' | 'Projects' | 'Fleet' | 'Helpdesk' | 'Inventory';
    title: string;
    detail: string;
    href: string;
}

export interface Comparison {
    current: number;
    previous: number;
    /** % change vs previous; null when the previous value is zero (no meaningful base). */
    changePct: number | null;
}

export interface CompanyHealth {
    asOf: string;
    periods: { currentLabel: string; previousLabel: string };
    finance: null | {
        revenue: Comparison;
        expense: Comparison;
        netProfit: Comparison;
        marginPct: number | null;
        ytdRevenue: number;
        ytdNetProfit: number;
        cashBalance: number;
        receivables: { total: number; over60: number; over90: number; over60Pct: number | null; glReconciled: boolean | null };
        payablesTotal: number;
    };
    operations: null | {
        openOrders: number;
        agedOver10Days: number;
        agedOver30Days: number;
        completed: Comparison;
    };
    projects: null | {
        active: number;
        overdue: number;
        overBudget: number;
        totalBudget: number;
        totalActualCost: number;
        budgetUsedPct: number | null;
    };
    fleet: null | { insuranceExpired: number; insuranceExpiring30d: number };
    helpdesk: null | { openTickets: number; slaBreached: number };
    inventory: null | { pendingRequests: number; pendingOver3Days: number };
    exceptions: HealthException[];
}

const DAY_MS = 24 * 3600 * 1000;
const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
const OPEN_SOD_STATUSES = ['PENDING', 'INPROGRESS', 'ASSIGNED'] as const;
const FINISHED_PROJECT_STATUSES = ['COMPLETED', 'CANCELLED', 'SLT_PAT_PASSED', 'PRE_PAT_PASSED'] as const;

export function compare(current: number, previous: number): Comparison {
    return {
        current,
        previous,
        changePct: previous === 0 ? null : ((current - previous) / Math.abs(previous)) * 100,
    };
}

export function monthBounds(now: Date) {
    const y = now.getUTCFullYear();
    const m = now.getUTCMonth();
    const currentStart = new Date(Date.UTC(y, m, 1));
    const previousStart = new Date(Date.UTC(y, m - 1, 1));
    const previousEnd = new Date(currentStart.getTime() - 1);
    // Compare like with like: month-to-date against the same number of days of the previous month,
    // otherwise a half-finished month always looks like a collapse against a full one.
    const previousSameSpanEnd = new Date(Math.min(previousEnd.getTime(), previousStart.getTime() + (now.getTime() - currentStart.getTime())));
    const yearStart = new Date(Date.UTC(y, 0, 1));
    const label = (d: Date) => d.toLocaleString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' });
    return { currentStart, previousStart, previousEnd, previousSameSpanEnd, yearStart, currentLabel: label(currentStart), previousLabel: label(previousStart) };
}

export class CompanyHealthService {
    static async getCompanyHealth(permissions: readonly string[], now: Date = new Date()): Promise<CompanyHealth> {
        const has = (p: string) => permissions.includes(p);
        const b = monthBounds(now);
        const exceptions: HealthException[] = [];

        // Sections run one after another on purpose: each fans out several queries, and running all
        // of them at once can exhaust the Prisma connection pool (P2024) shared with live traffic.
        const finance = has(RBAC_PERMISSIONS.FINANCE_READ) ? await this.financeSection(b, now, exceptions) : null;
        const operations = has(RBAC_PERMISSIONS.SOD_READ) ? await this.operationsSection(b, now, exceptions) : null;
        const projects = has(RBAC_PERMISSIONS.PROJECT_READ) ? await this.projectsSection(now, exceptions) : null;
        const fleet = has(RBAC_PERMISSIONS.FLEET_READ) ? await this.fleetSection(now, exceptions) : null;
        const helpdesk = has(RBAC_PERMISSIONS.HELPDESK_READ) ? await this.helpdeskSection(exceptions) : null;
        const inventory = has(RBAC_PERMISSIONS.INVENTORY_READ) ? await this.inventorySection(now, exceptions) : null;

        const rank: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };
        exceptions.sort((a, c) => rank[a.severity] - rank[c.severity]);

        return {
            asOf: now.toISOString(),
            periods: { currentLabel: b.currentLabel, previousLabel: b.previousLabel },
            finance, operations, projects, fleet, helpdesk, inventory, exceptions,
        };
    }

    private static async financeSection(b: ReturnType<typeof monthBounds>, now: Date, ex: HealthException[]): Promise<NonNullable<CompanyHealth['finance']>> {
        // Batches of at most three concurrent queries (see getCompanyHealth).
        const [cur, prev, ytd] = await Promise.all([
            LedgerReportService.getPnlReport(b.currentStart, now),
            LedgerReportService.getPnlReport(b.previousStart, b.previousSameSpanEnd),
            LedgerReportService.getPnlReport(b.yearStart, now),
        ]);
        const [cash, ar, ap] = await Promise.all([
            LedgerReportService.getCashFlowReport(undefined, now),
            // Company-wide aging. Callers must already hold company-wide access (the route checks it).
            ArApService.getArAgingReport(null, { unscoped: true }),
            ArApService.getApAgingReport(null, { unscoped: true }),
        ]);

        const over60 = ar.summary.days61to90 + ar.summary.over90;
        const over60Pct = ar.summary.total > 0 ? (over60 / ar.summary.total) * 100 : null;
        const marginPct = cur.totalRevenue > 0 ? (cur.netProfit / cur.totalRevenue) * 100 : null;

        if (cur.netProfit < 0) {
            ex.push({ id: 'fin-loss', severity: 'critical', area: 'Finance', title: 'Loss-making month', detail: `Net result ${fmt(cur.netProfit)} for ${b.currentLabel}`, href: '/finance/reports/pnl' });
        }
        if (ar.summary.over90 > 0) {
            ex.push({ id: 'fin-ar90', severity: 'critical', area: 'Finance', title: 'Receivables over 90 days', detail: `${fmt(ar.summary.over90)} outstanding more than 90 days`, href: '/finance/ar/aging' });
        } else if (over60Pct !== null && over60Pct > 25) {
            ex.push({ id: 'fin-ar60', severity: 'warning', area: 'Finance', title: 'Receivables ageing', detail: `${over60Pct.toFixed(0)}% of receivables is older than 60 days`, href: '/finance/ar/aging' });
        }
        if (!ar.isReconciled) {
            ex.push({ id: 'fin-arrec', severity: 'warning', area: 'Finance', title: 'AR sub-ledger differs from GL', detail: 'AR aging total does not match the AR-1110 control account', href: '/finance/ar/aging' });
        }
        if (cash.closingCash < 0) {
            ex.push({ id: 'fin-cash', severity: 'critical', area: 'Finance', title: 'Negative cash position', detail: `Bank and petty cash net ${fmt(cash.closingCash)}`, href: '/finance/bank' });
        }

        return {
            revenue: compare(cur.totalRevenue, prev.totalRevenue),
            expense: compare(cur.totalExpense, prev.totalExpense),
            netProfit: compare(cur.netProfit, prev.netProfit),
            marginPct,
            ytdRevenue: ytd.totalRevenue,
            ytdNetProfit: ytd.netProfit,
            cashBalance: cash.closingCash,
            receivables: { total: ar.summary.total, over60, over90: ar.summary.over90, over60Pct, glReconciled: ar.isReconciled },
            payablesTotal: ap.summary.total,
        };
    }

    private static async operationsSection(b: ReturnType<typeof monthBounds>, now: Date, ex: HealthException[]): Promise<NonNullable<CompanyHealth['operations']>> {
        const open = { status: { in: [...OPEN_SOD_STATUSES] } };
        const [openOrders, aged10, aged30, doneCur, donePrev] = await Promise.all([
            prisma.serviceOrder.count({ where: open }),
            prisma.serviceOrder.count({ where: { ...open, receivedDate: { lt: new Date(now.getTime() - 10 * DAY_MS) } } }),
            prisma.serviceOrder.count({ where: { ...open, receivedDate: { lt: new Date(now.getTime() - 30 * DAY_MS) } } }),
            prisma.serviceOrder.count({ where: { completedDate: { gte: b.currentStart, lte: now } } }),
            prisma.serviceOrder.count({ where: { completedDate: { gte: b.previousStart, lte: b.previousSameSpanEnd } } }),
        ]);

        if (aged30 > 0) {
            ex.push({ id: 'ops-aged30', severity: 'critical', area: 'Operations', title: 'Service orders open over 30 days', detail: `${aged30} orders have been open for more than 30 days`, href: '/service-orders' });
        } else if (aged10 > 0) {
            ex.push({ id: 'ops-aged10', severity: 'warning', area: 'Operations', title: 'Service orders open over 10 days', detail: `${aged10} orders have been open for more than 10 days`, href: '/service-orders' });
        }

        return { openOrders, agedOver10Days: aged10, agedOver30Days: aged30, completed: compare(doneCur, donePrev) };
    }

    private static async projectsSection(now: Date, ex: HealthException[]): Promise<NonNullable<CompanyHealth['projects']>> {
        const projects = await prisma.project.findMany({
            where: { status: { in: ['IN_PROGRESS', 'ON_HOLD', 'PLANNING'] } },
            select: { budget: true, actualCost: true, endDate: true, status: true },
        });
        let overdue = 0, overBudget = 0, totalBudget = 0, totalActual = 0;
        for (const p of projects) {
            const budget = p.budget === null ? null : Number(p.budget);
            const actual = Number(p.actualCost);
            if (budget !== null) { totalBudget += budget; totalActual += actual; if (budget > 0 && actual > budget) overBudget++; }
            if (p.endDate && p.endDate < now && !(FINISHED_PROJECT_STATUSES as readonly string[]).includes(p.status)) overdue++;
        }
        if (overBudget > 0) ex.push({ id: 'prj-budget', severity: 'critical', area: 'Projects', title: 'Projects over budget', detail: `${overBudget} active projects have spent more than their budget`, href: '/projects' });
        if (overdue > 0) ex.push({ id: 'prj-overdue', severity: 'warning', area: 'Projects', title: 'Projects past end date', detail: `${overdue} projects are past their planned end date`, href: '/projects' });

        return {
            active: projects.length, overdue, overBudget, totalBudget, totalActualCost: totalActual,
            budgetUsedPct: totalBudget > 0 ? (totalActual / totalBudget) * 100 : null,
        };
    }

    private static async fleetSection(now: Date, ex: HealthException[]): Promise<NonNullable<CompanyHealth['fleet']>> {
        const soon = new Date(now.getTime() + 30 * DAY_MS);
        const [expired, expiring] = await Promise.all([
            prisma.vMInsurancePolicy.count({ where: { status: 'ACTIVE', expiry_date: { lt: now } } }),
            prisma.vMInsurancePolicy.count({ where: { status: 'ACTIVE', expiry_date: { gte: now, lte: soon } } }),
        ]);
        if (expired > 0) ex.push({ id: 'flt-exp', severity: 'critical', area: 'Fleet', title: 'Vehicle insurance expired', detail: `${expired} active policies are past their expiry date`, href: '/fleet' });
        if (expiring > 0) ex.push({ id: 'flt-soon', severity: 'warning', area: 'Fleet', title: 'Vehicle insurance expiring', detail: `${expiring} policies expire within 30 days`, href: '/fleet' });
        return { insuranceExpired: expired, insuranceExpiring30d: expiring };
    }

    private static async helpdeskSection(ex: HealthException[]): Promise<NonNullable<CompanyHealth['helpdesk']>> {
        const open = { status: { notIn: ['RESOLVED', 'CLOSED'] as ('RESOLVED' | 'CLOSED')[] } };
        const [openTickets, slaBreached] = await Promise.all([
            prisma.ticket.count({ where: open }),
            prisma.ticket.count({ where: { ...open, slaResolutionBreached: true } }),
        ]);
        if (slaBreached > 0) ex.push({ id: 'hd-sla', severity: 'warning', area: 'Helpdesk', title: 'Helpdesk SLA breached', detail: `${slaBreached} open tickets have breached their resolution SLA`, href: '/helpdesk' });
        return { openTickets, slaBreached };
    }

    private static async inventorySection(now: Date, ex: HealthException[]): Promise<NonNullable<CompanyHealth['inventory']>> {
        const pending = { status: 'PENDING' };
        const [pendingRequests, pendingOld] = await Promise.all([
            prisma.stockRequest.count({ where: pending }),
            prisma.stockRequest.count({ where: { ...pending, createdAt: { lt: new Date(now.getTime() - 3 * DAY_MS) } } }),
        ]);
        if (pendingOld > 0) ex.push({ id: 'inv-pending', severity: 'warning', area: 'Inventory', title: 'Stock requests waiting over 3 days', detail: `${pendingOld} requests have not been actioned for more than 3 days`, href: '/inventory/approvals' });
        return { pendingRequests, pendingOver3Days: pendingOld };
    }
}
