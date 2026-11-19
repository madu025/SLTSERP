import { roleLabel } from '@/lib/gate-eligibility';

/**
 * Area approval of a contractor invoice before it goes to OSP Quality. It is a normal process gate (INVOICE CREATED -> AREA_APPROVED,
 * queue mode) whose steps an administrator can reorder on the gate screen; the default is Area Coordinator, QC Officer, Contractor,
 * Engineer (skipped when the area has none), Area Manager. A contractor can have 50-100 service orders in one invoice, so the approval
 * is on the invoice, and an approver can take service orders out of it (they go back to the verification list).
 *
 * `Invoice.confirmStage` is only a marker kept in step with the gate: IN_GATE = waiting for the gate to be started, a role code =
 * waiting at that step, CONFIRMED = every step done (also the value of every invoice that existed before the gate).
 */
export const INVOICE_GATE = { entityType: 'INVOICE', fromStatus: 'CREATED', toStatus: 'AREA_APPROVED' } as const;
export const STAGE_RESTART = 'IN_GATE';
export const STAGE_STARTING = 'STARTING';
export const STAGE_DONE = 'CONFIRMED';

export function stageLabel(stage: string | null | undefined): string {
    if (!stage) return '-';
    if (stage === STAGE_DONE) return 'Area approved';
    if (stage === STAGE_RESTART || stage === STAGE_STARTING) return 'Starting approval';
    return roleLabel(stage);
}

export interface ApprovalHistoryEntry { userId: string; stage: string; action: string }

/** Only approvals since the last return count: a returned invoice starts again with fresh approvals. */
export function confirmationsSinceReturn(history: ApprovalHistoryEntry[]): ApprovalHistoryEntry[] {
    let last = -1;
    history.forEach((h, i) => { if (h.action === 'RETURNED' || h.action === 'RESTARTED') last = i; });
    return history.slice(last + 1).filter((h) => h.action === 'CONFIRMED');
}

export type ApprovalPlan =
    | { ok: true }
    | { ok: false; reason: 'NOT_IN_CHAIN' | 'NO_PERMISSION_FOR_STAGE' | 'OUTSIDE_AREA' | 'SAME_PERSON_TWO_STAGES'; message: string };

/** Decides whether a person may approve the step an invoice is waiting at. Pure, so every rule is testable without a database. */
export function planApproval(input: {
    /** the invoice has an open step in the gate */
    waiting: boolean;
    stageLabel: string;
    userId: string;
    /** the person holds this step (capability, role or contractor) */
    canAct: boolean;
    inScope: boolean;
    history: ApprovalHistoryEntry[];
}): ApprovalPlan {
    const { waiting, stageLabel: label, userId, canAct, inScope, history } = input;
    if (!waiting) return { ok: false, reason: 'NOT_IN_CHAIN', message: 'This invoice is not waiting for an approval' };
    if (!canAct) return { ok: false, reason: 'NO_PERMISSION_FOR_STAGE', message: `Waiting for the ${label}; you do not hold that step` };
    if (!inScope) return { ok: false, reason: 'OUTSIDE_AREA', message: 'This invoice is outside your area' };
    if (confirmationsSinceReturn(history).some((h) => h.userId === userId)) {
        return { ok: false, reason: 'SAME_PERSON_TWO_STAGES', message: 'You already approved another step of this invoice; a different person must approve this step' };
    }
    return { ok: true };
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Figures of an invoice after some of its service orders were taken out. The total is the contractor amounts of the orders that stay;
 * the percentage based deductions (retention, WHT) follow the total in the same proportion; an advance deduction is a fixed amount and
 * stays (it never exceeds the new total).
 */
export function figuresAfterRemoval(input: { oldTotal: number; newTotal: number; retention: number; wht: number; advance: number }) {
    const ratio = input.oldTotal > 0 ? input.newTotal / input.oldTotal : 0;
    return {
        totalAmount: round2(input.newTotal),
        retentionAmount: round2(input.retention * ratio),
        whtAmount: round2(input.wht * ratio),
        advanceDeduction: round2(Math.min(input.advance, input.newTotal)),
    };
}
