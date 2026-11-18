/**
 * The contractor reviews a new invoice before it goes on to OSP Quality (SF Audit).
 *
 * AWAITING  - created, waiting for the contractor
 * CONFIRMED - the contractor accepted it; it now waits in the OSP Quality queue (also the value of every older invoice)
 * DISPUTED  - the contractor disagrees and gave a reason; the office corrects it and sends it back (AWAITING)
 */
export const CONTRACTOR_CONFIRM_STATES = ['AWAITING', 'CONFIRMED', 'DISPUTED'] as const;
export type ContractorConfirmState = (typeof CONTRACTOR_CONFIRM_STATES)[number];

export const CONTRACTOR_CONFIRM_LABEL: Record<ContractorConfirmState, string> = {
    AWAITING: 'Awaiting contractor',
    CONFIRMED: 'Confirmed by contractor',
    DISPUTED: 'Disputed by contractor',
};

export type ContractorConfirmAction = 'CONFIRM' | 'DISPUTE' | 'RESEND';

export type ContractorConfirmPlan =
    | { ok: true; next: ContractorConfirmState }
    | { ok: false; reason: 'NOT_OWN_INVOICE' | 'NOT_AWAITING' | 'NOT_DISPUTED' | 'REASON_REQUIRED'; message: string };

/** What a contractor (CONFIRM / DISPUTE) or the office (RESEND) may do to an invoice in its current state. Pure. */
export function planContractorConfirmation(input: {
    state: string;
    action: ContractorConfirmAction;
    /** for CONFIRM / DISPUTE: the signed-in contractor owns the invoice */
    isOwnInvoice: boolean;
    note?: string | null;
}): ContractorConfirmPlan {
    const { state, action, isOwnInvoice } = input;
    if (action === 'RESEND') {
        if (state !== 'DISPUTED') return { ok: false, reason: 'NOT_DISPUTED', message: 'Only a disputed invoice can be sent back to the contractor' };
        return { ok: true, next: 'AWAITING' };
    }
    if (!isOwnInvoice) return { ok: false, reason: 'NOT_OWN_INVOICE', message: 'This invoice belongs to another contractor' };
    if (state !== 'AWAITING') return { ok: false, reason: 'NOT_AWAITING', message: state === 'CONFIRMED' ? 'You have already confirmed this invoice' : 'This invoice is not waiting for your confirmation' };
    if (action === 'DISPUTE' && (input.note?.trim().length ?? 0) < 3) return { ok: false, reason: 'REASON_REQUIRED', message: 'Tell us what is wrong with the invoice (at least 3 characters)' };
    return { ok: true, next: action === 'CONFIRM' ? 'CONFIRMED' : 'DISPUTED' };
}

/** An invoice is in the OSP Quality (SF Audit) queue only once the area chain and the contractor have both confirmed it. */
export function isReadyForOspQuality(inv: { confirmStage: string; contractorConfirmStatus: string; statusA: string }): boolean {
    return inv.confirmStage === 'CONFIRMED' && inv.contractorConfirmStatus === 'CONFIRMED' && inv.statusA === 'PENDING_SF_AUDIT';
}
