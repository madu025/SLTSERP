/**
 * Barrel export for all dashboard sub-components.
 *
 * Usage in `page.tsx`:
 * ```tsx
 * import {
 *   DashboardError, DashboardFilters, StatsCardGrid,
 *   ChartSection, PerformanceSection, RTOMTables,
 *   type Stats, COLORS,
 * } from './components';
 * ```
 */

// Types & constants
export type { Stats } from './types';
export { COLORS, PAT_COLORS, tooltipStyle } from './types';

// Components
export { StatCard, type StatCardProps } from './StatCard';
export { DashboardError, type DashboardErrorProps } from './DashboardError';
export { DashboardFilters, type DashboardFiltersProps } from './DashboardFilters';
export { StatsCardGrid, type StatsCardGridProps } from './StatsCardGrid';
export { ChartSection, type ChartSectionProps } from './ChartSection';
export { PerformanceSection, type PerformanceSectionProps } from './PerformanceSection';
export { RTOMTables, type RTOMTablesProps } from './RTOMTables';
