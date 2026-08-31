/**
 * Centralized Constants for SOD Module
 * Prevents Magic Strings and ensures DRY principles across the SLTSERP codebase.
 * Single source of truth for all SOD status groupings.
 */

export enum SodStatus {
    COMPLETED = 'COMPLETED',
    RETURN = 'RETURN',
    INPROGRESS = 'INPROGRESS',
    PROV_CLOSED = 'PROV_CLOSED',
    INSTALL_CLOSED = 'INSTALL_CLOSED',
    DISAPPEARED = 'DISAPPEARED',
    OFFLINE = 'OFFLINE',
    PENDING = 'PENDING',
    ASSIGNED = 'ASSIGNED',
    ASSIGN = 'ASSIGN',
    CLOSED = 'CLOSED',
    PASSED = 'PASSED',
    PAT_OPMC_PASSED = 'PAT_OPMC_PASSED',
    PAT_CORRECTED = 'PAT_CORRECTED',
    PAT_OPMC_REJECTED = 'PAT_OPMC_REJECTED',
    PAT_REJECTED = 'PAT_REJECTED',
    RETURNED = 'RETURNED',
    CANCELLED = 'CANCELLED',
}

// ── Status Domain Validation (single source of truth for writers) ──

/** Values legitimately writable to `sltsStatus` (portal-mirror domain) */
export const SOD_SLTS_STATUS_VALUES = [
    SodStatus.INPROGRESS,
    SodStatus.PROV_CLOSED,
    SodStatus.INSTALL_CLOSED,
    SodStatus.COMPLETED,
    SodStatus.RETURN,
    SodStatus.DISAPPEARED,
    SodStatus.OFFLINE,
    SodStatus.PAT_OPMC_PASSED,
    SodStatus.PAT_OPMC_REJECTED,
    SodStatus.PAT_CORRECTED,
    SodStatus.PAT_REJECTED,
] as const;

/** Values legitimately writable to `status` (ERP internal workflow domain) */
export const SOD_WORKFLOW_STATUS_VALUES = [
    SodStatus.PENDING,
    SodStatus.ASSIGNED,
    SodStatus.ASSIGN,
    SodStatus.INPROGRESS,
    SodStatus.PROV_CLOSED,
    SodStatus.INSTALL_CLOSED,
    SodStatus.COMPLETED,
    SodStatus.DISAPPEARED,
    SodStatus.RETURNED,
    SodStatus.PAT_OPMC_PASSED,
    SodStatus.PAT_OPMC_REJECTED,
    SodStatus.PAT_CORRECTED,
    SodStatus.PAT_REJECTED,
] as const;

/** Portal-terminal statuses: the portal has confirmed the work is done */
export const SOD_SLTS_TERMINAL_STATUSES = [
    SodStatus.INSTALL_CLOSED,
    SodStatus.COMPLETED,
    SodStatus.PAT_OPMC_PASSED,
    SodStatus.PAT_CORRECTED,
] as const;

/** Workflow statuses that must NEVER exist beneath a portal-terminal sltsStatus */
export const SOD_STALE_ACTIVE_STATUSES = [
    SodStatus.PENDING,
    SodStatus.ASSIGNED,
    SodStatus.ASSIGN,
    SodStatus.INPROGRESS,
    SodStatus.OFFLINE,
    SodStatus.PROV_CLOSED,
] as const;

// ── External Status Mappings (from SLT Portal / ISHAMP / Excel) ──

/** External statuses that indicate physical field work is done */
export const SOD_EXTERNAL_COMPLETION_STATUSES = [
    SodStatus.INSTALL_CLOSED,
    SodStatus.COMPLETED,
    'FINISHED',
    'PAT_PASSED',
    SodStatus.PAT_OPMC_PASSED,
    SodStatus.PAT_CORRECTED,
] as const;

/** External statuses that indicate the SOD was returned / cancelled */
export const SOD_RETURN_STATUSES = [
    SodStatus.RETURN,
    SodStatus.RETURNED,
    'FIELD_RETURN',
    SodStatus.CANCELLED,
    'CANCEL',
    'COMPLETED-RETURN',
    'REJECTED',
] as const;

// ── Internal Query Groupings (for table filtering) ──

/** sltsStatus values that indicate completion (query service) */
export const SOD_QUERY_COMPLETION_STATUSES = [
    SodStatus.COMPLETED,
    SodStatus.INSTALL_CLOSED,
    SodStatus.PAT_OPMC_PASSED,
    SodStatus.PAT_CORRECTED,
] as const;

/** sltsStatus values excluded from the pending table */
export const SOD_EXCLUDED_FROM_PENDING = [
    SodStatus.COMPLETED,
    SodStatus.INSTALL_CLOSED,
    SodStatus.RETURN,
] as const;

/** Sync statuses treated as completed (detailed master data processing) */
export const SOD_SYNC_COMPLETION_STATUSES = [
    SodStatus.COMPLETED,
    SodStatus.INSTALL_CLOSED,
    SodStatus.PAT_OPMC_PASSED,
    'PAT_PASSED',
    'PAT_PASSED_OPMC',
] as const;

/** Default statuses shown in the pending table (status field) */
export const SOD_PENDING_DEFAULT_STATUSES = [
    SodStatus.PENDING,
    SodStatus.ASSIGNED,
    SodStatus.ASSIGN,
    SodStatus.INPROGRESS,
    SodStatus.PROV_CLOSED,
    SodStatus.DISAPPEARED,
] as const;

// ── Display Helpers (single computed status for the UI) ──

/** Human-readable labels for statuses that live only in the workflow `status` field */
const SOD_WORKFLOW_DISPLAY_LABELS: Record<string, string> = {
    [SodStatus.DISAPPEARED]: 'DISAPPEARED',
    [SodStatus.PAT_OPMC_PASSED]: 'PAT OPMC PASSED',
    [SodStatus.PAT_OPMC_REJECTED]: 'PAT OPMC REJECTED',
    [SodStatus.PAT_CORRECTED]: 'PAT CORRECTED',
    [SodStatus.PAT_REJECTED]: 'PAT REJECTED',
    [SodStatus.RETURNED]: 'RETURN',
    [SodStatus.ASSIGNED]: 'ASSIGNED',
    [SodStatus.ASSIGN]: 'ASSIGNED',
};

/** Minimal shape needed to compute the display status (works with Prisma rows and API DTOs) */
export interface SodStatusSource {
    sltsStatus?: string | null;
    status?: string | null;
}

/**
 * Single computed operational status for display, merging both stored fields.
 * Precedence:
 *  1. DISAPPEARED / PAT stage / RETURNED / ASSIGNED - workflow-only dimensions,
 *     surfaced because sltsStatus cannot represent them
 *  2. RETURN - workflow return beats a stale portal state
 *  3. sltsStatus - portal truth (COMPLETED / INSTALL_CLOSED / INPROGRESS /
 *     RETURN / PROV_CLOSED / OFFLINE / ...); workflow PENDING beneath an
 *     active portal status resolves to the portal status
 */
export function getComputedSodStatus(order: SodStatusSource): string {
    const workflowStatus = (order.status || '').toUpperCase();
    const portalStatus = (order.sltsStatus || '').toUpperCase();

    if (SOD_WORKFLOW_DISPLAY_LABELS[workflowStatus]) return SOD_WORKFLOW_DISPLAY_LABELS[workflowStatus];
    if (workflowStatus === SodStatus.RETURN) return SodStatus.RETURN;
    if (portalStatus) return portalStatus;
    return workflowStatus || '-';
}
