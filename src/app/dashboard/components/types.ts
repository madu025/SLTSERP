/**
 * Shared types and constants for the Dashboard component suite.
 *
 * Extracted from `src/app/dashboard/page.tsx` to enable reuse across
 * the dashboard sub-components (StatCard, StatsCardGrid, ChartSection,
 * PerformanceSection, RTOMTables, …).
 */

export interface Stats {
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
    availableRegions?: string[];
    rtomRegionMap?: Record<string, string>;
    userRole?: string;
    userAccessibleRtoms?: string[];
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
