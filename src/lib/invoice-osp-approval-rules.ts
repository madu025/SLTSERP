/**
 * After SF Audit (OSP Quality) verified a contractor invoice:
 *   DRAFT -> Finance sends it -> PENDING_OSP_APPROVAL -> an OSP manager approves -> APPROVED
 * APPROVED is what the Head Office payment run already waits for (payment request, Head Office pack, Head Office reference).
 * An OSP manager can also return it to Finance with a reason (back to DRAFT). Pure rules, so every one is testable without a database.
 */
export const OSP_PENDING = 'PENDING_OSP_APPROVAL';

export type OspAction = 'SEND' | 'APPROVE' | 'RETURN';

export interface OspInvoiceState {
    approvalFlow: string;
    approvalStatus: string;
    statusA: string;
    contractorConfirmStatus: string;
    confirmStage: string;
    ospSentById: string | null;
}

export type OspPlan =
    | { ok: true; next: 'PENDING_OSP_APPROVAL' | 'APPROVED' | 'DRAFT' }
    | { ok: false; reason: 'NOT_OSP_FLOW' | 'NOT_VERIFIED' | 'WRONG_STATE' | 'SAME_PERSON' | 'REASON_REQUIRED'; message: string };

export function planOspStep(input: { invoice: OspInvoiceState; action: OspAction; actorId: string; note?: string | null }): OspPlan {
    const { invoice: inv, action, actorId } = input;
    if (inv.approvalFlow !== 'OSP_CHAIN') return { ok: false, reason: 'NOT_OSP_FLOW', message: 'This invoice uses the older single approval' };
    if (action === 'SEND') {
        if (inv.approvalStatus !== 'DRAFT') return { ok: false, reason: 'WRONG_STATE', message: inv.approvalStatus === OSP_PENDING ? 'Already sent to the OSP managers' : 'This invoice is not waiting to be sent' };
        if (inv.statusA !== 'SF_AUDIT_APPROVED') return { ok: false, reason: 'NOT_VERIFIED', message: 'OSP Quality (SF Audit) has not verified this invoice yet' };
        if (inv.contractorConfirmStatus !== 'CONFIRMED' || inv.confirmStage !== 'CONFIRMED') return { ok: false, reason: 'NOT_VERIFIED', message: 'The contractor and the area approvals must confirm this invoice first' };
        return { ok: true, next: OSP_PENDING };
    }
    if (inv.approvalStatus !== OSP_PENDING) return { ok: false, reason: 'WRONG_STATE', message: 'This invoice is not waiting for an OSP manager' };
    if (action === 'APPROVE') {
        if (inv.ospSentById && inv.ospSentById === actorId) return { ok: false, reason: 'SAME_PERSON', message: 'You sent this invoice; a different person must approve it' };
        return { ok: true, next: 'APPROVED' };
    }
    if ((input.note?.trim().length ?? 0) < 3) return { ok: false, reason: 'REASON_REQUIRED', message: 'A reason is required to return an invoice' };
    return { ok: true, next: 'DRAFT' };
}

/** The older single approval must not be used on an invoice that runs through the OSP chain. */
export function legacyApprovalAllowed(approvalFlow: string): boolean {
    return approvalFlow !== 'OSP_CHAIN';
}
