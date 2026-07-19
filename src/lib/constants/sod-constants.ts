/**
 * Centralized Constants for SOD Module
 * Prevents Magic Strings and ensures DRY principles across the SLTSERP codebase.
 */

export enum SodStatus {
    COMPLETED = 'COMPLETED',
    RETURN = 'RETURN',
    INPROGRESS = 'INPROGRESS',
    PROV_CLOSED = 'PROV_CLOSED',
    INSTALL_CLOSED = 'INSTALL_CLOSED',
}

export const SOD_COMPLETION_STATUSES = [
    SodStatus.INSTALL_CLOSED
];

export const SOD_RETURN_STATUSES = [
    SodStatus.RETURN,
    'RETURNED',
    'REJECTED',
    'CANCELLED',
    'CANCEL',
    'COMPLETED-RETURN'
];
