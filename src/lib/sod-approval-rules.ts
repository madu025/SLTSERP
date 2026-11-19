import { roleLabel } from '@/lib/gate-eligibility';

/**
 * Approval of a completed service order before a contractor invoice can be made. It is a normal process gate
 * (SERVICE_ORDER COMPLETED -> INVOICABLE, queue mode) whose steps an administrator can reorder on the gate screen; the default is
 * Area Coordinator, QC Officer, Contractor, Engineer (skipped when the area has none), Area Manager.
 *
 * `ServiceOrder.sodApprovalStage` is only a marker kept in step with the gate: null = not in the chain (older orders keep the
 * single "Verify Completed SODs" step), IN_GATE = waiting for the gate to be (re)started, a role code = waiting at that step,
 * CONFIRMED = every step done and the order is invoicable.
 */
export const SOD_GATE = { entityType: 'SERVICE_ORDER', fromStatus: 'COMPLETED', toStatus: 'INVOICABLE' } as const;
export const SOD_STAGE_RESTART = 'IN_GATE';
export const SOD_STAGE_DONE = 'CONFIRMED';

/** Statuses that start the chain: the order is finished and can in principle be billed. */
export const SOD_CHAIN_ENTRY_STATUSES = ['COMPLETED', 'INSTALL_CLOSED', 'PROV_CLOSED'] as const;

export function sodStageLabel(stage: string | null | undefined): string {
    if (!stage) return '-';
    if (stage === SOD_STAGE_DONE) return 'Approved for invoice';
    if (stage === SOD_STAGE_RESTART) return 'Starting approval';
    return roleLabel(stage);
}

export interface ApprovalHistoryEntry { userId: string; stage: string; action: string }

/** Only approvals since the last return count: a returned order starts again with fresh approvals. */
export function confirmationsSinceReturn(history: ApprovalHistoryEntry[]): ApprovalHistoryEntry[] {
    let last = -1;
    history.forEach((h, i) => { if (h.action === 'RETURNED' || h.action === 'RESTARTED') last = i; });
    return history.slice(last + 1).filter((h) => h.action === 'CONFIRMED');
}

export type ApprovalPlan =
    | { ok: true }
    | { ok: false; reason: 'NOT_IN_CHAIN' | 'NO_PERMISSION_FOR_STAGE' | 'OUTSIDE_AREA' | 'SAME_PERSON_TWO_STAGES'; message: string };

/** Decides whether a person may approve the step an order is waiting at. Pure, so every rule is testable without a database. */
export function planApproval(input: {
    /** the order has an open step in the gate */
    waiting: boolean;
    stageLabel: string;
    userId: string;
    /** the person holds this step (capability, role or contractor) */
    canAct: boolean;
    inScope: boolean;
    history: ApprovalHistoryEntry[];
}): ApprovalPlan {
    const { waiting, stageLabel, userId, canAct, inScope, history } = input;
    if (!waiting) return { ok: false, reason: 'NOT_IN_CHAIN', message: 'This order is not waiting for an approval' };
    if (!canAct) return { ok: false, reason: 'NO_PERMISSION_FOR_STAGE', message: `Waiting for the ${stageLabel}; you do not hold that step` };
    if (!inScope) return { ok: false, reason: 'OUTSIDE_AREA', message: 'This order is outside your area' };
    if (confirmationsSinceReturn(history).some((h) => h.userId === userId)) {
        return { ok: false, reason: 'SAME_PERSON_TWO_STAGES', message: 'You already approved another step of this order; a different person must approve this step' };
    }
    return { ok: true };
}
