/**
 * Centralized Constants for SOD Module
 * Prevents Magic Strings and ensures DRY principles across the SLTSERP codebase.
 * Single source of truth for all SOD status groupings.
 */

// Mirrors the pruned ServiceOrderStatus Prisma enum. Values that exist only as
// EXTERNAL portal strings (RETURNED, CANCELLED, RETURN_PENDING, ...) are matched
// as plain strings in the mapping lists below - they are never stored.
export enum SodStatus {
    COMPLETED = 'COMPLETED',
    RETURN = 'RETURN',
    INPROGRESS = 'INPROGRESS',
    ASSIGNED = 'ASSIGNED',
    PROV_CLOSED = 'PROV_CLOSED',
    INSTALL_CLOSED = 'INSTALL_CLOSED',
    DISAPPEARED = 'DISAPPEARED',
    PENDING = 'PENDING',
    PAT_OPMC_PASSED = 'PAT_OPMC_PASSED',
    PAT_CORRECTED = 'PAT_CORRECTED',
    PAT_OPMC_REJECTED = 'PAT_OPMC_REJECTED',
    PAT_REJECTED = 'PAT_REJECTED',
}

// ── Status Domain Validation (single source of truth for writers) ──

/** Values legitimately writable to `sltsStatus` (portal-mirror domain) */
export const SOD_SLTS_STATUS_VALUES = [
    SodStatus.INPROGRESS,
    SodStatus.ASSIGNED,
    SodStatus.PROV_CLOSED,
    SodStatus.INSTALL_CLOSED,
    SodStatus.COMPLETED,
    SodStatus.RETURN,
    SodStatus.DISAPPEARED,
    SodStatus.PAT_OPMC_PASSED,
    SodStatus.PAT_OPMC_REJECTED,
    SodStatus.PAT_CORRECTED,
    SodStatus.PAT_REJECTED,
] as const;

/** Values legitimately writable to `status` (ERP internal workflow domain) */
export const SOD_WORKFLOW_STATUS_VALUES = [
    SodStatus.PENDING,
    SodStatus.INPROGRESS,
    SodStatus.ASSIGNED,
    SodStatus.PROV_CLOSED,
    SodStatus.INSTALL_CLOSED,
    SodStatus.COMPLETED,
    SodStatus.DISAPPEARED,
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
    SodStatus.INPROGRESS,
    SodStatus.ASSIGNED,
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

/** External statuses that indicate the SOD was returned / cancelled (portal strings, never stored) */
export const SOD_RETURN_STATUSES = [
    SodStatus.RETURN,
    'RETURNED',
    'FIELD_RETURN',
    'CANCELLED',
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
    SodStatus.INPROGRESS,
    SodStatus.ASSIGNED,
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
};

/** Minimal shape needed to compute the display status (works with Prisma rows and API DTOs) */
export interface SodStatusSource {
    sltsStatus?: string | null;
    status?: string | null;
}

/**
 * Single computed operational status for display, merging both stored fields.
 * Precedence:
 *  1. DISAPPEARED / PAT stage - workflow-only dimensions, surfaced because
 *     sltsStatus cannot represent them
 *  2. RETURN - workflow return beats a stale portal state
 *  3. sltsStatus - portal truth (COMPLETED / INSTALL_CLOSED / INPROGRESS /
 *     RETURN / PROV_CLOSED / ...); workflow PENDING beneath an
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

/** Report family groups: FNC aggregates the nc-family buckets, FRL the rl-family buckets. */
export type SodOrderFamily = 'nc' | 'rl' | 'data';

/** Completed sub-buckets: create/recon/upgrade roll up into FNC; or/ml roll up into FRL. */
export type SodCompletedBucket = 'create' | 'recon' | 'upgrade' | 'or' | 'ml' | 'data';

/**
 * SLT portal SOD numbers embed the date the order was raised: <PREFIX><YYYYMMDD><seq>
 * (e.g. CEN202608170082986 -> 2026-08-17). The portal feeds no receipt timestamp, so
 * this is the only truthful lower bound for when the RTOM got the job; measured across
 * live data the real receivedDate is never earlier than it (median lag 2 days).
 * Returns midnight UTC of that date, or null when the number carries no plausible date.
 */
export function orderRaiseDateFromSoNum(soNum?: string | null): Date | null {
    const raw = (soNum || '').trim().toUpperCase();
    const letters = raw.search(/[^A-Z]/);
    if (letters <= 0) return null;
    const digits = raw.slice(letters);
    if (digits.length < 8 || !/^[0-9]+$/.test(digits.slice(0, 8))) return null;

    const year = Number(digits.slice(0, 4));
    const month = Number(digits.slice(4, 6));
    const day = Number(digits.slice(6, 8));
    const currentYear = new Date().getUTCFullYear();
    if (year < 2018 || year > currentYear + 1 || month < 1 || month > 12 || day < 1 || day > 31) return null;

    const stamp = Date.UTC(year, month - 1, day);
    // Reject impossible dates such as 2026-02-30 (epoch day rolls into another month).
    const probe = new Date(stamp);
    if (probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) return null;
    return probe;
}

/**
 * Truthful receipt anchor for a SOD whose row only appeared after the work had already
 * closed (missing-history backfill): the order-raise date carried in the SOD number,
 * clamped so it can never land after the completion instant. Falls back to the
 * completion instant only when the number holds no date, which the daily report then
 * recognises as a sync artifact rather than a receipt.
 */
export function backfillReceiptDate(soNum?: string | null, completionDate?: Date | null): Date | null {
    const raised = orderRaiseDateFromSoNum(soNum);
    if (!raised) return completionDate || null;
    if (!completionDate) return raised;
    return raised.getTime() <= completionDate.getTime() ? raised : completionDate;
}

/** Single categorization rule for the NC/RL/DATA breakdown and the CR/RC/UP/OR/ML/DT buckets. CREATE-OR must win over CREATE. */
export function categorizeSodOrder(
    orderType?: string | null,
    pkg?: string | null
): { family: SodOrderFamily; bucket: SodCompletedBucket } {
    const ot = (orderType || '').toUpperCase();
    const p = (pkg || '').toUpperCase();

    // Relocation family first
    if (ot.includes('CREATE-OR')) return { family: 'rl', bucket: 'or' };
    if (ot.includes('MODIFY-LOCATION') || ot.includes('MODIFY LOCATION')) return { family: 'rl', bucket: 'ml' };
    if (ot.includes('F-RL') || p.includes('FRL')) return { family: 'rl', bucket: 'data' };

    // New-connection family
    if (ot.includes('RECON')) return { family: 'nc', bucket: 'recon' };
    if (ot.includes('UPGRADE') || ot.includes('UPGRD')) return { family: 'nc', bucket: 'upgrade' };
    if (ot.includes('F-NC') || p.includes('FNC')) return { family: 'nc', bucket: 'create' };
    if (ot.includes('CREATE')) return { family: 'nc', bucket: 'create' };
    if (p.includes('VOICE') || p.includes('INT') || p.includes('IPTV')) return { family: 'nc', bucket: 'create' };

    return { family: 'data', bucket: 'data' };
}
