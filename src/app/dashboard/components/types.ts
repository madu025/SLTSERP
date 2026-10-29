/**
 * Shared types and constants for the Dashboard component suite.
 *
 * Extracted from `src/app/dashboard/page.tsx` to enable reuse across
 * the dashboard sub-components (StatCard, StatsCardGrid, ChartSection,
 * PerformanceSection, RTOMTables, …).
 */

export interface Stats {
    /** Server timestamp, when supplied by the dashboard API. */
    updatedAt?: string;
    monthly: {
        total: number;
        completed: number;
        pending: number;
        returned: number;
        invoicable: number;
    };
    allTime: {
        total: number;
        completed: number;
        returned: number;
        pending: number;
        invoicable: number;
        broughtForward?: number;
    };
    pat: {
        passed: number;
        rejected: number;
        pending: number;
    };
    contractors: Array<{
        name: string;
        completed: number;
        total: number;
        percentage: number;
    }>;
    rtoms: Array<{
        name: string;
        completed: number;
        pending: number;
        returned: number;
        total: number;
        revenue?: number;
        patPassed?: number;
        patRejected?: number;
        sltsPatRejected?: number;
    }>;
    statusBreakdown: Array<{
        status: string;
        count: number;
    }>;
    aging: Array<{
        range: string;
        count: number;
    }>;
    financials?: {
        totalRevenue: number;
        totalContractorCost: number;
        netMargin: number;
        marginPercentage: number;
    };
    financeSummary?: {
        invoicedTotal: number;
        pendingInvoices: number;
        pendingInvoiceAmount: number;
        uninvoicedCompletedAmount: number;
    };
    vehicleSummary?: {
        activeVehicles: number;
        monthlyTrips: number;
        pendingVehiclePayments: number;
    };
    procurementSummary?: {
        /** Survey requests are an operational queue, not procurement approvals. */
        pendingSurveyRequests?: number;
        pendingApprovals?: number;
        totalVendors: number;
    };
    sla?: {
        slaBreachedCount: number;
        targetSlaPercentage: number;
    };
    availableRegions?: string[];
    rtomRegionMap?: Record<string, string>;
    userRole?: string;
    userAccessibleRtoms?: string[];
}

export interface DashboardFilterMetadata {
    availableRegions: string[];
    rtomRegionMap: Record<string, string>;
    userAccessibleRtoms: string[];
}

export interface ExecutiveDashboardData {
    generatedAt?: string;
    projectStats: {
        total: number;
        active: number;
        delayed: number;
        completed: number;
        planning: number;
        cancelled?: number;
        completionRate: number;
        byStatus: Array<{ status: string; count: number }>;
        byType: Array<{ type: string; count: number }>;
    };
    budgetStats: {
        totalBudget: number;
        totalSpent: number;
        totalVariance: number;
        spendRate: number;
        overBudgetProjects: number;
        avgProgress: number;
    };
    patStats: {
        total: number;
        passed: number;
        failed: number;
        passRate: number;
        avgPassRate: number | null;
        prePATCount: number;
        sltPATCount: number;
    };
    contractorRankings: Array<{
        rank: number;
        name: string;
        score: number;
        qualityScore?: number | null;
        safetyScore?: number | null;
        scheduleScore?: number | null;
        patPassPct?: number | null;
        hseIncidents?: number | null;
        month?: string | Date | null;
    }>;
    recentActivity: {
        recentProjects: Array<{
            id: string;
            name: string;
            status: string;
            progress: number;
            updatedAt: string;
            opmc?: { name: string } | null;
        }>;
        recentPAT: Array<{
            id: string;
            patType: string;
            status: string;
            passRate?: number | null;
            completedAt?: string | null;
            project?: { name: string } | null;
        }>;
        highRiskPredictions: Array<{
            id: string;
            predictionType: string;
            riskLevel: string;
            predictedImpact?: string | number | null;
            recommendation?: string | null;
            project?: { id: string; name: string } | null;
        }>;
    };
    controlTower?: {
        asOf?: string;
        workflow: {
            tasks: { total: number; open: number; overdue: number; blocked: number; criticalOpen: number };
            approvals: { projectRequestsOpen: number; stageApprovalsOpen: number; reviewsPending: number; reviewsRework: number; handoffsPending: number };
        };
        materials: { requiredQty: number; reservedQty: number; issuedQty: number; shortageQty: number; requirementCount: number; shortageRequirementCount: number; available: boolean };
        closeout: {
            pat: { completed: number; failed: number; open: number };
            asBuilt: { totalDocuments: number; approvedDocuments: number; pendingDocuments: number };
            invoices: { count: number; totalAmount: number; paidAmount: number; balanceAmount: number; openCount: number };
        };
        risks: { openCount: number; topActionable: Array<{ id: string; projectId: string; projectCode?: string | null; projectName: string; title: string; score: number; status: string }> };
        changeRequests: { openCount: number; byStatus: Array<{ status: string; count: number }> };
        coverage: { unknown: string[] };
    };
    asOf?: string;
    updatedAt?: string;
}

/**
 * Theme-aware chart palette (readable in both light & dark).
 * Used by the Monthly Status pie chart and any other chart that cycles
 * through the default 4-colour sequence.
 */
export const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#6366f1'];

/**
 * 3-colour palette dedicated to the PAT Distribution pie chart.
 * Kept separate from {@link COLORS} so the PAT visual identity (green →
 * red → indigo) stays stable regardless of future palette changes.
 */
export const PAT_COLORS = ['#10b981', '#ef4444', '#6366f1'];

/**
 * Shared inline style object for Recharts `<Tooltip>` across every chart
 * in the dashboard. Keeps tooltips visually consistent and theme-aware.
 */
export const tooltipStyle = {
    backgroundColor: 'var(--color-card, #ffffff)',
    borderRadius: '12px',
    border: '1px solid var(--color-border, #e2e8f0)',
    color: 'var(--color-foreground, #0f172a)',
    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.15)',
    fontSize: '12px',
} as const;
