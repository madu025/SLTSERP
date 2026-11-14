import type { HealthException } from '@/services/core/company-health.service';
import type { ControlSummary } from '@/lib/control-shared';

/**
 * Management exceptions for the control environment, built from one plain summary so the Company Health tab, the
 * Control monitor page and the 07:45 digest always agree.
 */
export function buildControlExceptions(s: ControlSummary): HealthException[] {
    const ex: HealthException[] = [];
    const href = '/admin/control';

    if (s.voucherSelfPaid30d > 0) {
        ex.push({ id: 'ctl-voucher-selfpaid', severity: 'critical', area: 'Controls', title: 'Payments approved and paid by one person', detail: `${s.voucherSelfPaid30d} payment voucher(s) in the last 30 days were approved and paid, or approved after being created, by the same person`, href });
    }
    const other = s.breaches30d - s.voucherSelfPaid30d;
    if (other > 0) {
        ex.push({ id: 'ctl-sod-breaches', severity: 'warning', area: 'Controls', title: 'Separation-of-duties breaches', detail: `${other} record(s) in the last 30 days were approved by the person who created or requested them`, href });
    }
    if (s.overridePrivileged > 0) {
        ex.push({ id: 'ctl-override-priv', severity: 'warning', area: 'Controls', title: 'Approval or admin rights granted by manual override', detail: `${s.overridePrivileged} user(s) hold approval or admin rights through a direct permission override instead of a role`, href });
    }
    if (s.sodConflictUsers > 0) {
        ex.push({ id: 'ctl-sod-conflicts', severity: 'warning', area: 'Controls', title: 'Users holding conflicting permissions', detail: `${s.sodConflictUsers} non-admin user(s) can both record and approve the same kind of transaction`, href });
    }
    if (s.failedLogins7d >= 20) {
        ex.push({ id: 'ctl-failed-logins', severity: 'warning', area: 'Controls', title: 'Many failed sign-ins', detail: `${s.failedLogins7d} failed sign-in attempts in the last 7 days`, href });
    }
    if (s.dormant > 0) {
        ex.push({ id: 'ctl-dormant', severity: 'info', area: 'Controls', title: 'Dormant accounts', detail: `${s.dormant} active account(s) have not signed in for 60 days or more`, href });
    }
    if (s.hashBreaks > 0) {
        ex.push({ id: 'ctl-hash-chain', severity: 'warning', area: 'Controls', title: 'Journal integrity check found differences', detail: `${s.hashBreaks} journal entr${s.hashBreaks === 1 ? 'y does' : 'ies do'} not match the recorded hash chain; review in the Control monitor`, href });
    }
    if (s.openPastPeriods > 0) {
        ex.push({ id: 'ctl-period-open', severity: 'warning', area: 'Controls', title: 'Past months still open', detail: `${s.openPastPeriods} earlier month(s) are not closed, so back-dated postings are still possible`, href });
    }
    if (s.bankBacklogOver30 > 0) {
        ex.push({ id: 'ctl-bank-backlog', severity: 'info', area: 'Controls', title: 'Bank statement lines unreconciled', detail: `${s.bankBacklogOver30} line(s) are more than 30 days old and still unreconciled`, href });
    }
    if (s.backdated30d > 0) {
        ex.push({ id: 'ctl-backdated', severity: 'info', area: 'Controls', title: 'Back-dated journal postings', detail: `${s.backdated30d} entr${s.backdated30d === 1 ? 'y was' : 'ies were'} dated in an earlier month than the day they were entered`, href });
    }
    if (s.oldestApprovalDays !== null && s.oldestApprovalDays >= 14 && s.approvalsOverSla >= 0) {
        ex.push({ id: 'ctl-approval-ageing', severity: 'warning', area: 'Controls', title: 'Approvals waiting two weeks or more', detail: `The oldest pending approval has been waiting ${s.oldestApprovalDays} days`, href });
    }
    return ex;
}
