import { roleLabel } from '@/lib/gate-eligibility';

/**
 * The area approval of a completed service ORDER before the engineer can invoice it. It is a normal process gate
 * (SERVICE_ORDER COMPLETED -> READY_FOR_INVOICE, queue mode: no single assignee, area-scoped) whose steps an administrator can reorder on
 * the gate screen; the default is Area Coordinator, then QC Officer. When the last step approves, the order is READY: the engineer
 * of the area can put it on an invoice. The invoice itself is approved later (contractor, Area Manager).
 *
 * `ServiceOrder.sodApprovalStage` is only a marker kept in step with the gate: null = not in the chain yet, IN_GATE = waiting for the
 * gate to (re)start, a role code = waiting at that step, READY = every step done. CONFIRMED is the same as READY for orders that
 * passed the earlier chain.
 */
export const SOD_GATE = { entityType: 'SERVICE_ORDER', fromStatus: 'COMPLETED', toStatus: 'READY_FOR_INVOICE' } as const;
export const SOD_STAGE_RESTART = 'IN_GATE';
export const SOD_STAGE_STARTING = 'STARTING';
export const SOD_STAGE_READY = 'READY';
/** An order enters the approval chain, and can be invoiced, only when all three PAT approvals (SLTS, OPMC, HO) have passed. */
export const SOD_PAT_PASSED = { sltsPatStatus: 'PAT_PASSED', opmcPatStatus: 'PAT_PASSED', hoPatStatus: 'PAT_PASSED' } as const;
export const SOD_PAT_WAITING_MESSAGE = 'The PAT approvals of this order are not all passed yet; it can be approved once they have passed';
/** The step that checks the order's photos before it can be invoiced, and what it must state to pass. */
export const SOD_PHOTO_CHECK_ROLE = 'QC_OFFICER';
export const SOD_PHOTO_CHECK_NOTE = 'Photos received and checked';
export const SOD_PHOTO_CHECK_MESSAGE = 'Confirm that the photos of this order were received and checked before passing it';
/** An order is ready for the engineer in either of these stages. */
export const SOD_READY_STAGES: readonly string[] = [SOD_STAGE_READY, 'CONFIRMED'];

/** Statuses that start the chain: the order is finished. Only orders with a contractor are ever invoiced. */
export const SOD_CHAIN_ENTRY_STATUSES = ['COMPLETED', 'INSTALL_CLOSED', 'PROV_CLOSED'] as const;

export function sodStageLabel(stage: string | null | undefined): string {
    if (!stage) return 'Not started';
    if (SOD_READY_STAGES.includes(stage)) return 'Ready for the engineer';
    if (stage === SOD_STAGE_RESTART || stage === SOD_STAGE_STARTING) return 'Starting approval';
    return roleLabel(stage);
}

/**
 * An order completed in an earlier month than the billing month is a late SOD: it is billed in the month it is invoiced in, and the
 * invoice shows it as late. Months are compared as year*12+month, so December to January is handled.
 */
export function isLateSod(completedDate: Date | string | null | undefined, billingMonth: number, billingYear: number): boolean {
    if (!completedDate) return false;
    const d = new Date(completedDate);
    return d.getFullYear() * 12 + d.getMonth() < billingYear * 12 + (billingMonth - 1);
}

/** "June 2026", for the note on a late SOD. */
export function completedMonthLabel(completedDate: Date | string | null | undefined): string {
    if (!completedDate) return '';
    const d = new Date(completedDate);
    return d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
}
