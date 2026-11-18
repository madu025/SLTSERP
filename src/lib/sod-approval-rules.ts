import { CONFIRM_STAGES, CONFIRM_START_STAGE, STAGE_LABEL, canConfirm, isConfirmStage, nextStage, type ConfirmStage, type InvoiceConfirmStage } from '@/lib/invoice-confirm-rules';

/**
 * Area approval chain of a completed service order, before a contractor invoice can be made:
 * Area Coordinator -> QC Officer -> Area Engineer / Officer (only when the area has one) -> Area Manager.
 *
 * It uses the same four stages, capabilities and separation-of-duties rule as the invoice chain it replaces
 * (src/lib/invoice-confirm-rules.ts). `SodApprovalStage` is the stage the order is waiting at; CONFIRMED means the
 * chain is complete and the order is verified for invoicing. A null stage means the order is not in the chain.
 */
export type SodApprovalStage = InvoiceConfirmStage;
export { CONFIRM_STAGES as SOD_APPROVAL_STAGES, CONFIRM_START_STAGE as SOD_APPROVAL_START, STAGE_LABEL as SOD_APPROVAL_LABEL, isConfirmStage as isSodApprovalStage };

/** Statuses that start the chain: the order is finished and can in principle be billed. */
export const SOD_CHAIN_ENTRY_STATUSES = ['COMPLETED', 'INSTALL_CLOSED', 'PROV_CLOSED'] as const;

export interface ApprovalHistoryEntry { userId: string; stage: string; action: string }

/** Only confirmations since the last return count: a returned order starts again with fresh approvals. */
export function confirmationsSinceReturn(history: ApprovalHistoryEntry[]): ApprovalHistoryEntry[] {
    let last = -1;
    history.forEach((h, i) => { if (h.action === 'RETURNED') last = i; });
    return history.slice(last + 1).filter((h) => h.action === 'CONFIRMED');
}

export type ApprovalPlan =
    | { ok: true; next: SodApprovalStage }
    | { ok: false; reason: 'NOT_IN_CHAIN' | 'NO_PERMISSION_FOR_STAGE' | 'OUTSIDE_AREA' | 'SAME_PERSON_TWO_STAGES'; message: string };

/** Decides what approving does for one order. Pure, so every rule is testable without a database. */
export function planApproval(input: {
    stage: string | null;
    userId: string;
    /** the stages this user holds the capability for */
    userStages: ReadonlySet<string>;
    inScope: boolean;
    history: ApprovalHistoryEntry[];
    areaHasEngineer: boolean;
}): ApprovalPlan {
    const { stage, userId, userStages, inScope, history, areaHasEngineer } = input;
    if (!stage || !isConfirmStage(stage)) return { ok: false, reason: 'NOT_IN_CHAIN', message: 'This order is not waiting for an approval' };
    if (!userStages.has(stage)) return { ok: false, reason: 'NO_PERMISSION_FOR_STAGE', message: `Waiting for the ${STAGE_LABEL[stage as ConfirmStage]}; you do not hold that role` };
    if (!inScope) return { ok: false, reason: 'OUTSIDE_AREA', message: 'This order is outside your area' };
    if (!canConfirm(userId, confirmationsSinceReturn(history), stage as ConfirmStage)) {
        return { ok: false, reason: 'SAME_PERSON_TWO_STAGES', message: 'You already approved another stage of this order; a different person must approve this stage' };
    }
    return { ok: true, next: nextStage(stage as ConfirmStage, areaHasEngineer) };
}
