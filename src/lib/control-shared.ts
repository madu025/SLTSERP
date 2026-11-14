/** Client-safe rules and report shapes for the Control monitor (access risk, SoD breaches, approvals, finance controls, audit). */
import { RBAC_PERMISSIONS as P } from '@/config/rbac-permissions';

export const DAY_MS = 24 * 3600 * 1000;
export const DORMANT_DAYS = 60;
export const PASSWORD_MAX_AGE_DAYS = 180;

/** Pairs of capabilities one person should not hold together (maker and checker, or doer and auditor). */
export const SOD_CONFLICTS: { id: string; label: string; a: string; b: string }[] = [
    { id: 'finance-write-approve', label: 'Finance: record and approve', a: P.FINANCE_WRITE, b: P.FINANCE_APPROVE },
    { id: 'project-finance-write-approve', label: 'Project finance: record and approve', a: P.PROJECT_FINANCE_WRITE, b: P.PROJECT_FINANCE_APPROVE },
    { id: 'procurement-inventory-approve', label: 'Procurement orders and stock approval', a: P.PROCUREMENT_WRITE, b: P.INVENTORY_APPROVE },
    { id: 'inventory-write-approve', label: 'Stores: record and approve', a: P.INVENTORY_WRITE, b: P.INVENTORY_APPROVE },
    { id: 'audit-finance-write', label: 'Audit and finance entry', a: P.FINANCE_AUDIT, b: P.FINANCE_WRITE },
];

export function findSodConflicts(permissions: readonly string[]): { id: string; label: string }[] {
    const set = new Set(permissions);
    return SOD_CONFLICTS.filter((c) => set.has(c.a) && set.has(c.b)).map(({ id, label }) => ({ id, label }));
}

/** Holders of these are exempt from most maker-checker rules, so each is a standing exception. */
export function isPrivileged(permissions: readonly string[]): boolean {
    return permissions.includes(P.ADMIN_SUPER) || permissions.includes(P.ADMIN_RBAC);
}

export type ActivityState = 'NEVER' | 'DORMANT' | 'ACTIVE';

/** NEVER = no recorded sign-in since tracking began; DORMANT = last sign-in older than the limit. */
export function activityState(lastLoginAt: Date | string | null | undefined, now: Date, dormantDays = DORMANT_DAYS): ActivityState {
    if (!lastLoginAt) return 'NEVER';
    return now.getTime() - new Date(lastLoginAt).getTime() > dormantDays * DAY_MS ? 'DORMANT' : 'ACTIVE';
}

/** Days since the password was last changed; null when it has never been recorded. */
export function passwordAgeDays(changedAt: Date | string | null | undefined, now: Date): number | null {
    return changedAt ? Math.floor((now.getTime() - new Date(changedAt).getTime()) / DAY_MS) : null;
}

/** A posting dated in an earlier month than the day it was actually entered. */
export function isBackdated(entryDate: Date | string, createdAt: Date | string): boolean {
    const d = new Date(entryDate);
    const c = new Date(createdAt);
    return d.getUTCFullYear() * 12 + d.getUTCMonth() < c.getUTCFullYear() * 12 + c.getUTCMonth();
}

/** Same person on both sides of a maker-checker pair. Missing ids never match (they are reported separately). */
export function samePerson(a: string | null | undefined, b: string | null | undefined): boolean {
    return !!a && !!b && a === b;
}

// ---- report shapes ---------------------------------------------------------------------------------------------

export interface RiskUser { id: string; username: string; name: string | null; detail: string }

export interface AccessRiskReport {
    asOf: string;
    activeUsers: number;
    privileged: RiskUser[];
    overrides: RiskUser[];
    overridePrivileged: RiskUser[];
    noPermissions: RiskUser[];
    noScope: RiskUser[];
    sodConflicts: (RiskUser & { conflicts: string[] })[];
    dormant: RiskUser[];
    neverLoggedIn: RiskUser[];
    oldPasswords: RiskUser[];
    inactiveRoleAssignments: number;
    failedLogins7d: { total: number; byUser: { username: string; count: number }[] };
    trackingSince: string | null;
    notes: string[];
}

export type BreachKind =
    | 'VOUCHER_APPROVED_AND_PAID' | 'VOUCHER_SELF_APPROVED' | 'VOUCHER_NO_CREATOR' | 'PROJECT_INVOICE_SELF_APPROVED' | 'AMENDMENT_SELF_APPROVED'
    | 'STOCK_REQUEST_SELF_APPROVED' | 'MRN_SELF_APPROVED' | 'CYCLE_COUNT_SELF_APPROVED' | 'DISPOSAL_SELF_APPROVED' | 'PO_SELF_APPROVED' | 'PETTY_CASH_SELF_APPROVED';

export const BREACH_LABEL: Record<BreachKind, string> = {
    VOUCHER_APPROVED_AND_PAID: 'Payment voucher approved and paid by the same person',
    VOUCHER_SELF_APPROVED: 'Payment voucher approved by its creator',
    VOUCHER_NO_CREATOR: 'Payment voucher approved with no recorded creator',
    PROJECT_INVOICE_SELF_APPROVED: 'Project invoice approved by its creator',
    AMENDMENT_SELF_APPROVED: 'Invoice amendment approved by its requester',
    STOCK_REQUEST_SELF_APPROVED: 'Stock request approved or released by its requester',
    MRN_SELF_APPROVED: 'Return note approved by the person who returned',
    CYCLE_COUNT_SELF_APPROVED: 'Stock count approved by the counter',
    DISPOSAL_SELF_APPROVED: 'Asset disposal approved by its requester',
    PO_SELF_APPROVED: 'Project purchase order approved by its creator',
    PETTY_CASH_SELF_APPROVED: 'Petty cash voucher approved by its creator',
};

export interface SodBreach { kind: BreachKind; reference: string; actorId: string; actor: string; at: string; amount: number | null; adminExempt: boolean }

export interface SodBreachReport {
    asOf: string;
    days: number;
    total: number;
    byKind: { kind: BreachKind; label: string; count: number }[];
    byActor: { actor: string; count: number; adminExempt: boolean }[];
    rows: SodBreach[];
}

export interface ApprovalAgeRow { type: string; pending: number; oldestDays: number | null; overSla: number | null; href: string }
export interface ApprovalAgeingReport { asOf: string; rows: ApprovalAgeRow[]; totalPending: number }

export interface FinanceControlsReport {
    asOf: string;
    days: number;
    backdated: { count: number; amount: number; sample: { reference: string; date: string; enteredAt: string }[] };
    reversals: { total: number; byReference: { reference: string; count: number }[] };
    withoutDimension: number;
    pendingJournals: { count: number; oldestDays: number | null };
    bankBacklog: { buckets: { bucket: string; count: number }[]; total: number };
    periods: { year: number; month: number; status: string; closedAt: string | null }[];
    openPastPeriods: number;
    hashChain: { checked: number; breaks: number; firstBreak: string | null };
}

export interface AuditActivityReport {
    asOf: string;
    days: number;
    perDay: { day: string; count: number }[];
    denied: { path: string; user: string; count: number }[];
    sensitive: { action: string; count: number; last: string }[];
    permissionChanges: { at: string; actor: string; target: string; action: string }[];
    offHours: number;
    total: number;
}

/** Plain summary the exception builder works from, so the dashboard and the 07:45 digest always agree. */
export interface ControlSummary {
    breaches30d: number;
    voucherSelfPaid30d: number;
    overridePrivileged: number;
    sodConflictUsers: number;
    neverLoggedIn: number;
    dormant: number;
    failedLogins7d: number;
    approvalsOverSla: number;
    oldestApprovalDays: number | null;
    hashBreaks: number;
    openPastPeriods: number;
    bankBacklogOver30: number;
    backdated30d: number;
}
