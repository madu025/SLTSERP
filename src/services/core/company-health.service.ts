import { prisma } from '@/lib/prisma';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { LedgerReportService } from '@/services/finance/ledger-report.service';
import { ArApService } from '@/services/finance/ar-ap.service';
import { LedgerBudgetService, expenseOverruns } from '@/services/finance/ledger-budget.service';
import { SOD_TURNAROUND_SLA_DAYS, SOD_FINANCIAL_COMPLETION_STATUSES } from '@/lib/constants/sod-constants';
import { SPI_ALERT_THRESHOLD } from '@/lib/project-evm';
import { SodPerformanceService } from '@/services/service-order/sod-performance.service';
import { ContractorScorecardService } from '@/services/contractor/contractor-scorecard.service';
import { OpsScoreboardService } from '@/services/service-order/ops-scoreboard.service';
import { ProcurementPerformanceService } from '@/services/procurement/procurement-performance.service';
import { InventoryHealthService } from '@/services/inventory/inventory-health.service';
import { VendorScorecardService } from '@/services/procurement/vendor-scorecard.service';
import { buildSupplyChainExceptions } from '@/services/procurement/supply-chain-exceptions';
import { AccessRiskService } from '@/services/control/access-risk.service';
import { SodBreachService } from '@/services/control/sod-breach.service';
import { ApprovalAgeingService } from '@/services/control/approval-ageing.service';
import { FinanceControlsService } from '@/services/control/finance-controls.service';
import { buildControlExceptions } from '@/services/control/control-exceptions';
import type { ControlSummary } from '@/lib/control-shared';

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
    area: 'Finance' | 'Operations' | 'Projects' | 'Fleet' | 'Helpdesk' | 'Inventory' | 'Procurement' | 'Controls';
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

export interface ProjectRisk {
    id: string;
    name: string;
    code: string;
    spi: number | null;
    overBudgetPct: number | null;
    daysLate: number | null;
}

export type ProjectHealthClass = 'onTrack' | 'behind' | 'critical' | 'untracked';

/** Worst signal wins: late or over budget is critical, then low SPI, then missing budget or end date. */
export function classifyProject(p: { overdue: boolean; overBudget: boolean; lowSpi: boolean; untracked: boolean }): ProjectHealthClass {
    if (p.overdue || p.overBudget) return 'critical';
    if (p.lowSpi) return 'behind';
    if (p.untracked) return 'untracked';
    return 'onTrack';
}

/** The last `count` calendar months ending with the month of `now` (UTC), oldest first. */
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function lastMonths(now: Date, count: number): { label: string; start: Date; end: Date }[] {
    const out: { label: string; start: Date; end: Date }[] = [];
    for (let i = count - 1; i >= 0; i--) {
        const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
        const endOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i + 1, 1) - 1);
        out.push({ label: MONTH_NAMES[start.getUTCMonth()], start, end: i === 0 ? now : endOfMonth });
    }
    return out;
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
        /** Receivables by age (current = 0-30 days). */
        arBuckets: { current: number; days31to60: number; days61to90: number; over90: number };
        /** Last six calendar months, oldest first; the last entry is the month to date. */
        monthly: { label: string; revenue: number; expense: number; profit: number }[];
    };
    operations: null | {
        openOrders: number;
        agedOver10Days: number;
        agedOver30Days: number;
        completed: Comparison;
        /** Open orders by age in days. */
        ageing: { bucket: string; count: number }[];
        /** Completed orders per calendar month, oldest first. */
        completedMonthly: { label: string; completed: number }[];
        /** The five weakest RTOMs by the scoreboard health number (30-day window). */
        weakestRtoms: { rtom: string; open: number; over14: number; slaPct: number | null; health: number | null }[];
    };
    projects: null | {
        active: number;
        overdue: number;
        overBudget: number;
        totalBudget: number;
        totalActualCost: number;
        budgetUsedPct: number | null;
        /** Active projects whose earned-value schedule index is below the alert threshold. */
        lowSpi: number;
        /** In-progress projects with no budget or no end date: their performance cannot be measured. */
        untracked: number;
        /** Active projects grouped by their worst signal. */
        health: { onTrack: number; behind: number; critical: number; untracked: number };
        /** Up to five projects with the most serious signals. */
        atRisk: ProjectRisk[];
    };
    fleet: null | { insuranceExpired: number; insuranceExpiring30d: number };
    helpdesk: null | { openTickets: number; slaBreached: number };
    inventory: null | { pendingRequests: number; pendingOver3Days: number };
    /** Procurement and stock charts; each part is null when the caller lacks that module's capability. */
    supplyChain: null | {
        lateBuckets: { bucket: string; count: number }[] | null;
        dead: { bucket: string; skus: number; value: number | null }[] | null;
        topVendors: { name: string; spend: number; score: number | null }[] | null;
        stockValue: number | null;
        belowReorder: number | null;
    };
    /** Control environment (administrators only): summary numbers plus the chart data. */
    controls: null | {
        summary: ControlSummary;
        breachByKind: { label: string; count: number }[];
        approvals: { type: string; pending: number; oldestDays: number | null }[];
    };
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
    static async getCompanyHealth(permissions: readonly string[], now: Date = new Date(), userId?: string): Promise<CompanyHealth> {
        const has = (p: string) => permissions.includes(p);
        const b = monthBounds(now);
        const exceptions: HealthException[] = [];

        // Sections run one after another on purpose: each fans out several queries, and running all
        // of them at once can exhaust the Prisma connection pool (P2024) shared with live traffic.
        const finance = has(RBAC_PERMISSIONS.FINANCE_READ) ? await this.financeSection(b, now, exceptions) : null;
        const operations = has(RBAC_PERMISSIONS.SOD_READ) ? await this.operationsSection(b, now, exceptions, userId) : null;
        const projects = has(RBAC_PERMISSIONS.PROJECT_READ) ? await this.projectsSection(now, exceptions) : null;
        const fleet = has(RBAC_PERMISSIONS.FLEET_READ) ? await this.fleetSection(now, exceptions) : null;
        const helpdesk = has(RBAC_PERMISSIONS.HELPDESK_READ) ? await this.helpdeskSection(exceptions) : null;
        const inventory = has(RBAC_PERMISSIONS.INVENTORY_READ) ? await this.inventorySection(now, exceptions) : null;
        const controls = has(RBAC_PERMISSIONS.ADMIN_RBAC) ? await this.controlsSection(now, exceptions) : null;
        const supplyChain = has(RBAC_PERMISSIONS.INVENTORY_READ) || has(RBAC_PERMISSIONS.PROCUREMENT_READ)
            ? await this.supplyChainSection(has(RBAC_PERMISSIONS.PROCUREMENT_READ), has(RBAC_PERMISSIONS.INVENTORY_READ), has(RBAC_PERMISSIONS.INVENTORY_COST_READ), now, exceptions)
            : null;

        const rank: Record<Severity, number> = { critical: 0, warning: 1, info: 2 };
        exceptions.sort((a, c) => rank[a.severity] - rank[c.severity]);

        return {
            asOf: now.toISOString(),
            periods: { currentLabel: b.currentLabel, previousLabel: b.previousLabel },
            finance, operations, projects, fleet, helpdesk, inventory, supplyChain, controls, exceptions,
        };
    }

    private static async financeSection(b: ReturnType<typeof monthBounds>, now: Date, ex: HealthException[]): Promise<NonNullable<CompanyHealth['finance']>> {
        // Batches of at most three concurrent queries (see getCompanyHealth).
        const [cur, prev, ytd] = await Promise.all([
            LedgerReportService.getPnlReport(b.currentStart, now),
            LedgerReportService.getPnlReport(b.previousStart, b.previousSameSpanEnd),
            LedgerReportService.getPnlReport(b.yearStart, now),
        ]);
        // Six-month trend: one P&L per month, one after another (each is several ledger queries)
        const monthly: { label: string; revenue: number; expense: number; profit: number }[] = [];
        for (const m of lastMonths(now, 6)) {
            const r = await LedgerReportService.getPnlReport(m.start, m.end);
            monthly.push({ label: m.label, revenue: r.totalRevenue, expense: r.totalExpense, profit: r.netProfit });
        }
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
        // Budget control: only when a company-wide budget exists for the year
        try {
            const budget = await LedgerBudgetService.getCompanyBudgetVsActual(now.getUTCFullYear(), now);
            const over = expenseOverruns(budget.rows);
            if (budget.hasBudget && over.length > 0) {
                const worst = over[0];
                ex.push({ id: 'fin-budget', severity: 'warning', area: 'Finance', title: 'Expenses over budget', detail: `${over.length} expense account(s) are more than 10% over their year-to-date budget; largest: ${worst.accountCode} (${fmt(-worst.variance)} over)`, href: '/finance/budget-vs-actual' });
            }
        } catch (error) {
            console.warn('[COMPANY-HEALTH] Budget check skipped:', error instanceof Error ? error.message : error);
        }
        await this.financeControlAlerts(now, ex);
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
            arBuckets: { current: ar.summary.current, days31to60: ar.summary.days31to60, days61to90: ar.summary.days61to90, over90: ar.summary.over90 },
            monthly,
        };
    }

    /** Month-end and collection discipline: stale bank reconciliation, period not closed, issued invoices past due. */
    private static async financeControlAlerts(now: Date, ex: HealthException[]): Promise<void> {
        try {
            const staleBefore = new Date(now.getTime() - 30 * DAY_MS);
            const staleLines = await prisma.bankStatementLine.count({ where: { reconciledAt: null, statementDate: { lt: staleBefore } } });
            if (staleLines > 0) {
                ex.push({ id: 'fin-bankrec', severity: 'warning', area: 'Finance', title: 'Bank reconciliation behind', detail: `${staleLines} bank statement line(s) older than 30 days are still unreconciled`, href: '/finance/bank-reconciliation' });
            }

            // Previous month should be closed once the first ten days of the new month have passed
            if (now.getUTCDate() > 10) {
                const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
                const period = await prisma.fiscalPeriod.findUnique({
                    where: { year_month: { year: prev.getUTCFullYear(), month: prev.getUTCMonth() + 1 } },
                    select: { status: true },
                });
                if (period && period.status === 'OPEN') {
                    ex.push({ id: 'fin-periodclose', severity: 'warning', area: 'Finance', title: 'Previous month not closed', detail: `${prev.toLocaleString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })} is still open after the 10th`, href: '/finance/period-close' });
                }
            }

            const overdue = await prisma.projectInvoice.aggregate({
                where: { type: 'CLIENT', status: { notIn: ['DRAFT', 'CANCELLED', 'REJECTED'] }, balanceAmount: { gt: 0 }, dueDate: { lt: now } },
                _sum: { balanceAmount: true },
                _count: true,
            });
            if (overdue._count > 0) {
                ex.push({ id: 'fin-overdue-inv', severity: 'warning', area: 'Finance', title: 'Issued invoices past due', detail: `${overdue._count} invoice(s) totalling ${fmt(Number(overdue._sum.balanceAmount ?? 0))} are past their due date`, href: '/finance/ar/aging' });
            }
        } catch (error) {
            console.warn('[COMPANY-HEALTH] Finance control checks skipped:', error instanceof Error ? error.message : error);
        }
    }

    private static async operationsSection(b: ReturnType<typeof monthBounds>, now: Date, ex: HealthException[], userId?: string): Promise<NonNullable<CompanyHealth['operations']>> {
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

        // Service-level view: turnaround SLA over 30 days and the RTOMs holding the oldest backlog
        try {
            const headline = await SodPerformanceService.getHeadline(now);
            if (headline.slaPct30d !== null && headline.completed30d >= 50 && headline.slaPct30d < 90) {
                const critical = headline.slaPct30d < 75;
                ex.push({ id: 'ops-sla', severity: critical ? 'critical' : 'warning', area: 'Operations', title: 'Service orders missing the turnaround target', detail: `Only ${headline.slaPct30d}% of the last ${headline.completed30d.toLocaleString('en-US')} completed orders finished within the ${SOD_TURNAROUND_SLA_DAYS}-day target`, href: '/service-orders/performance' });
            }
            for (const r of headline.worstRtoms.filter((x) => x.over14 >= 10)) {
                ex.push({ id: `ops-rtom-${r.rtom}`, severity: 'warning', area: 'Operations', title: `${r.rtom} backlog is ageing`, detail: `${r.over14} of ${r.open} open orders are older than 14 days`, href: '/service-orders/performance' });
            }
        } catch (error) {
            console.warn('[COMPANY-HEALTH] SLA headline skipped:', error instanceof Error ? error.message : error);
        }

        // Contractors falling short this month (ranked contractors only: thin volumes are never flagged)
        try {
            const card = await ContractorScorecardService.getCompanyScorecard(undefined, 2, now);
            const weak = card.rows
                .filter((r) => !r.current.lowVolume && ((r.current.score ?? 100) < 60 || (r.current.completed >= 20 && (r.current.slaPct ?? 100) < 70)))
                .sort((a, b) => (a.current.score ?? 0) - (b.current.score ?? 0))
                .slice(0, 5);
            for (const r of weak) {
                ex.push({ id: `ops-contractor-${r.contractorId}`, severity: 'warning', area: 'Operations', title: `${r.name} is under-performing`, detail: `Score ${r.current.score ?? 'n/a'} this month: ${r.current.slaPct ?? 'n/a'}% within ${SOD_TURNAROUND_SLA_DAYS} days, ${r.current.completed} orders completed`, href: '/contractors/scorecard' });
            }
        } catch (error) {
            console.warn('[COMPANY-HEALTH] Contractor scorecard skipped:', error instanceof Error ? error.message : error);
        }

        // Charts: completions per month, open-order ageing, weakest RTOMs (failures degrade to empty, never block the page)
        let ageing: { bucket: string; count: number }[] = [];
        let weakestRtoms: NonNullable<CompanyHealth['operations']>['weakestRtoms'] = [];
        let completedMonthly: { label: string; completed: number }[] = [];
        try {
            const months = lastMonths(now, 6);
            const rows = await prisma.$queryRawUnsafe<{ m: Date; n: bigint | number }[]>(
                `SELECT date_trunc('month', "completedDate" AT TIME ZONE 'UTC') AS m, count(*) AS n FROM "ServiceOrder"
                 WHERE "status"::text = ANY($1::text[]) AND "completedDate" >= $2::timestamptz AND "completedDate" <= $3::timestamptz GROUP BY 1`,
                [...SOD_FINANCIAL_COMPLETION_STATUSES] as string[], months[0].start, now,
            );
            const byMonth = new Map(rows.map((r) => [new Date(r.m).toISOString().slice(0, 7), Number(r.n)]));
            completedMonthly = months.map((m) => ({ label: m.label, completed: byMonth.get(m.start.toISOString().slice(0, 7)) ?? 0 }));
        } catch (error) {
            console.warn('[COMPANY-HEALTH] Completions trend skipped:', error instanceof Error ? error.message : error);
        }
        if (userId) {
            try {
                const board = await OpsScoreboardService.getScoreboard(userId, { windowDays: 30 }, now);
                weakestRtoms = board.rows.slice(0, 5).map((r) => ({ rtom: r.rtom, open: r.open, over14: r.over14, slaPct: r.slaPct, health: r.health }));
                const report = await SodPerformanceService.getReport(userId, new Date(now.getTime() - 30 * DAY_MS), now, now);
                const sum: Record<string, number> = {};
                for (const a of report.ageingByRtom) for (const [k, v] of Object.entries(a.buckets)) sum[k] = (sum[k] ?? 0) + v;
                ageing = ['0-3', '3-7', '7-14', '14-30', '30+'].map((k) => ({ bucket: k, count: sum[k] ?? 0 }));
            } catch (error) {
                console.warn('[COMPANY-HEALTH] Scoreboard skipped:', error instanceof Error ? error.message : error);
            }
        }

        return { openOrders, agedOver10Days: aged10, agedOver30Days: aged30, completed: compare(doneCur, donePrev), ageing, completedMonthly, weakestRtoms };
    }

    private static async projectsSection(now: Date, ex: HealthException[]): Promise<NonNullable<CompanyHealth['projects']>> {
        const projects = await prisma.project.findMany({
            where: { status: { in: ['IN_PROGRESS', 'ON_HOLD', 'PLANNING'] } },
            select: { id: true, name: true, projectCode: true, budget: true, actualCost: true, endDate: true, status: true, evm: { select: { spi: true } } },
        });
        let overdue = 0, overBudget = 0, totalBudget = 0, totalActual = 0, lowSpi = 0, untracked = 0;
        const health = { onTrack: 0, behind: 0, critical: 0, untracked: 0 };
        const risky: (ProjectRisk & { weight: number })[] = [];
        for (const p of projects) {
            const inProgress = p.status === 'IN_PROGRESS';
            const isUntracked = inProgress && (!(Number(p.budget ?? 0) > 0) || !p.endDate);
            const spi = p.evm?.spi === null || p.evm?.spi === undefined ? null : Number(p.evm.spi);
            const isLowSpi = inProgress && spi !== null && spi < SPI_ALERT_THRESHOLD;
            if (isUntracked) untracked++;
            if (isLowSpi) lowSpi++;
            const budget = p.budget === null ? null : Number(p.budget);
            const actual = Number(p.actualCost);
            const isOver = budget !== null && budget > 0 && actual > budget;
            if (budget !== null) { totalBudget += budget; totalActual += actual; if (isOver) overBudget++; }
            const isLate = !!p.endDate && p.endDate < now && !(FINISHED_PROJECT_STATUSES as readonly string[]).includes(p.status);
            if (isLate) overdue++;
            health[classifyProject({ overdue: isLate, overBudget: isOver, lowSpi: isLowSpi, untracked: isUntracked })]++;
            if (isLate || isOver || isLowSpi) {
                const daysLate = isLate && p.endDate ? Math.floor((now.getTime() - p.endDate.getTime()) / DAY_MS) : null;
                const overBudgetPct = isOver && budget ? Number((((actual - budget) / budget) * 100).toFixed(1)) : null;
                risky.push({ id: p.id, name: p.name, code: p.projectCode, spi, overBudgetPct, daysLate, weight: (isLate ? 2 : 0) + (isOver ? 2 : 0) + (isLowSpi ? 1 : 0) });
            }
        }
        const atRisk: ProjectRisk[] = risky
            .sort((a, c) => c.weight - a.weight || (c.daysLate ?? 0) - (a.daysLate ?? 0))
            .slice(0, 5)
            .map((r) => ({ id: r.id, name: r.name, code: r.code, spi: r.spi, overBudgetPct: r.overBudgetPct, daysLate: r.daysLate }));
        if (overBudget > 0) ex.push({ id: 'prj-budget', severity: 'critical', area: 'Projects', title: 'Projects over budget', detail: `${overBudget} active projects have spent more than their budget`, href: '/projects' });
        if (lowSpi > 0) ex.push({ id: 'prj-spi', severity: 'warning', area: 'Projects', title: 'Projects behind schedule', detail: `${lowSpi} in-progress project(s) have a schedule performance index below ${SPI_ALERT_THRESHOLD}`, href: '/projects' });
        if (untracked > 0) ex.push({ id: 'prj-untracked', severity: 'warning', area: 'Projects', title: 'Projects that cannot be tracked', detail: `${untracked} in-progress project(s) have no budget or no planned end date, so their progress against plan is unknown`, href: '/projects' });
        if (overdue > 0) ex.push({ id: 'prj-overdue', severity: 'warning', area: 'Projects', title: 'Projects past end date', detail: `${overdue} projects are past their planned end date`, href: '/projects' });

        return {
            active: projects.length, overdue, overBudget, totalBudget, totalActualCost: totalActual,
            budgetUsedPct: totalBudget > 0 ? (totalActual / totalBudget) * 100 : null,
            lowSpi, untracked, health, atRisk,
        };
    }

    /** Control environment: breaches, access risk, approval ageing, finance controls. Every part degrades to zero on failure. */
    private static async controlsSection(now: Date, ex: HealthException[]): Promise<NonNullable<CompanyHealth['controls']>> {
        const summary: ControlSummary = { breaches30d: 0, voucherSelfPaid30d: 0, overridePrivileged: 0, sodConflictUsers: 0, neverLoggedIn: 0, dormant: 0, failedLogins7d: 0, approvalsOverSla: 0, oldestApprovalDays: null, hashBreaks: 0, openPastPeriods: 0, bankBacklogOver30: 0, backdated30d: 0 };
        let breachByKind: { label: string; count: number }[] = [];
        let approvals: { type: string; pending: number; oldestDays: number | null }[] = [];
        try {
            const b = await SodBreachService.getReport(30, now);
            summary.breaches30d = b.total;
            summary.voucherSelfPaid30d = b.byKind.filter((k) => k.kind === 'VOUCHER_APPROVED_AND_PAID' || k.kind === 'VOUCHER_SELF_APPROVED').reduce((a, k) => a + k.count, 0);
            breachByKind = b.byKind.map((k) => ({ label: k.label, count: k.count }));
        } catch (error) { console.warn('[COMPANY-HEALTH] SoD breaches skipped:', error instanceof Error ? error.message : error); }
        try {
            const a = await AccessRiskService.getReport(now);
            summary.overridePrivileged = a.overridePrivileged.length;
            summary.sodConflictUsers = a.sodConflicts.length;
            summary.neverLoggedIn = a.neverLoggedIn.length;
            summary.dormant = a.dormant.length;
            summary.failedLogins7d = a.failedLogins7d.total;
        } catch (error) { console.warn('[COMPANY-HEALTH] Access risk skipped:', error instanceof Error ? error.message : error); }
        try {
            const r = await ApprovalAgeingService.getReport(now);
            approvals = r.rows.filter((x) => x.pending > 0).map((x) => ({ type: x.type, pending: x.pending, oldestDays: x.oldestDays }));
            summary.oldestApprovalDays = approvals.reduce<number | null>((m, x) => (x.oldestDays !== null && (m === null || x.oldestDays > m) ? x.oldestDays : m), null);
        } catch (error) { console.warn('[COMPANY-HEALTH] Approval ageing skipped:', error instanceof Error ? error.message : error); }
        try {
            const f = await FinanceControlsService.getReport(30, now);
            summary.hashBreaks = f.hashChain.breaks;
            summary.openPastPeriods = f.openPastPeriods;
            summary.bankBacklogOver30 = f.bankBacklog.buckets.slice(1).reduce((a, x) => a + x.count, 0);
            summary.backdated30d = f.backdated.count;
        } catch (error) { console.warn('[COMPANY-HEALTH] Finance controls skipped:', error instanceof Error ? error.message : error); }
        ex.push(...buildControlExceptions(summary));
        return { summary, breachByKind, approvals };
    }

    /** Company-wide procurement and stock picture. Reports are built for the whole company (this view is company-wide only). */
    private static async supplyChainSection(procurement: boolean, inventory: boolean, showValues: boolean, now: Date, ex: HealthException[]): Promise<NonNullable<CompanyHealth['supplyChain']>> {
        try {
            const p = procurement ? await ProcurementPerformanceService.getReport(null, now) : null;
            const h = inventory ? await InventoryHealthService.getReport(null, showValues, now) : null;
            const v = procurement ? await VendorScorecardService.getScorecard(null, 12, now) : null;
            ex.push(...buildSupplyChainExceptions(p, h, v));
            return {
                lateBuckets: p ? [...p.store.lateBuckets] : null,
                dead: h ? h.dead.map((d) => ({ bucket: d.bucket, skus: d.skus, value: d.value })) : null,
                topVendors: v ? v.rows.slice(0, 6).map((r) => ({ name: r.name, spend: r.spend, score: r.score })) : null,
                stockValue: h ? h.totals.value : null,
                belowReorder: h ? h.totals.belowReorder : null,
            };
        } catch (error) {
            console.warn('[COMPANY-HEALTH] Supply chain skipped:', error instanceof Error ? error.message : error);
            return { lateBuckets: null, dead: null, topVendors: null, stockValue: null, belowReorder: null };
        }
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
