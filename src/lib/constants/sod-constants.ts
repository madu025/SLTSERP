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
