/**
 * Where a contractor invoice is on its way to payment, in plain words. Pure, so every rule is testable without a database.
 *
 * A service order invoice runs through these steps (the OSP chain):
 *   1 created by the Engineer
 *   2 the contractor confirms it
 *   3 the Area Manager approves it
 *   4 OSP Quality (SF Audit) verifies it
 *   5 Finance sends it to the OSP managers
 *   6 an OSP Manager approves it
 *   7 Finance prepares the payment (a payment voucher)
 *   8 Head Office pays it
 * Older invoices ran a shorter chain (created, area, finance approval, paid).
 */
export type TrackStepState = 'done' | 'current' | 'waiting' | 'cancelled';

export interface TrackStep { key: string; label: string; state: TrackStepState; at: string | null; note?: string | null }

export interface TrackerInvoice {
    status: string;
    statusA: string;
    statusB?: string | null;
    approvalStatus: string;
    approvalFlow: string;
    confirmStage: string;
    contractorConfirmStatus: string;
    contractorConfirmedAt?: Date | string | null;
    createdAt: Date | string;
    ospSentAt?: Date | string | null;
    ospDecisionAt?: Date | string | null;
    ospNote?: string | null;
    contractorNote?: string | null;
    paidDateA?: Date | string | null;
    /** When the Area Manager (the last area step) approved it, from the approval record. */
    areaApprovedAt?: Date | string | null;
}

/** The payment voucher(s) of the invoice, summarised (none = no voucher yet). */
export interface TrackerVoucher { exists: boolean; createdAt?: Date | string | null; submittedToHoAt?: Date | string | null; paid?: boolean; hoPaidDate?: Date | string | null; hoReference?: string | null }

export interface InvoiceTrack {
    flow: 'OSP_CHAIN' | 'LEGACY';
    steps: TrackStep[];
    currentKey: string | null;
    stepNumber: number;
    totalSteps: number;
    finished: boolean;
    cancelled: boolean;
    /** One line: where the invoice is now. */
    headline: string;
    /** Who or what it waits for, or null when it is finished or cancelled. */
    waitingFor: string | null;
    /** The retention (claim B) is held back and released later. */
    retentionHeld: boolean;
}

const AREA_WORDS: Record<string, string> = {
    AREA_MANAGER: 'the Area Manager', AREA_COORDINATOR: 'the Area Coordinator', QC_OFFICER: 'the QC Officer', ENGINEER: 'the Engineer', CONTRACTOR: 'the contractor',
};

const iso = (d: Date | string | null | undefined): string | null => (d ? new Date(d).toISOString() : null);
const AUDITED = ['SF_AUDIT_APPROVED', 'AUDITED', 'APPROVED', 'PAID'];

export function trackInvoice(inv: TrackerInvoice, voucher: TrackerVoucher = { exists: false }): InvoiceTrack {
    const cancelled = inv.status === 'CANCELLED' || inv.confirmStage === 'CANCELLED';
    const paid = inv.status === 'PAID' || inv.statusA === 'PAID' || !!voucher.paid;
    const areaDone = inv.confirmStage === 'CONFIRMED' || paid;
    const audited = AUDITED.includes(inv.statusA) || AUDITED.includes(inv.status) || paid;
    const osp = inv.approvalFlow === 'OSP_CHAIN';
    const ospApproved = inv.approvalStatus === 'APPROVED' || paid;
    const ospSent = ospApproved || inv.approvalStatus === 'PENDING_OSP_APPROVAL' || !!inv.ospSentAt;
    const contractorDone = inv.contractorConfirmStatus === 'CONFIRMED' || areaDone || !!inv.contractorConfirmedAt;
    const areaWho = AREA_WORDS[inv.confirmStage] ?? 'the Area Manager';

    type Def = { key: string; label: string; done: boolean; at: Date | string | null | undefined; waitingFor: string; note?: string | null };
    const defs: Def[] = osp
        ? [
            { key: 'CREATED', label: 'Invoice created by the Engineer', done: true, at: inv.createdAt, waitingFor: '' },
            { key: 'CONTRACTOR', label: 'Contractor confirms the invoice', done: contractorDone, at: inv.contractorConfirmedAt, waitingFor: 'the contractor to confirm it', note: inv.contractorConfirmStatus === 'DISPUTED' ? inv.contractorNote : null },
            { key: 'AREA', label: 'Area Manager approves', done: areaDone, at: inv.areaApprovedAt, waitingFor: inv.confirmStage === 'CONTRACTOR' ? 'the contractor to confirm it' : `${areaWho} to approve it` },
            { key: 'SF_AUDIT', label: 'OSP Quality (SF Audit) verifies', done: audited, at: null, waitingFor: 'OSP Quality (SF Audit) to verify it' },
            { key: 'OSP_SEND', label: 'Finance sends it to the OSP managers', done: ospSent, at: inv.ospSentAt, waitingFor: 'Finance to send it to the OSP managers', note: inv.approvalStatus === 'DRAFT' && inv.ospNote ? `Returned by an OSP Manager: ${inv.ospNote}` : null },
            { key: 'OSP_APPROVE', label: 'OSP Manager approves', done: ospApproved, at: inv.ospDecisionAt, waitingFor: 'an OSP Manager to approve it' },
            { key: 'PAYMENT_REQUEST', label: 'Finance prepares the payment', done: voucher.exists || paid, at: voucher.createdAt, waitingFor: 'Finance to prepare the payment' },
            { key: 'HO_PAYMENT', label: 'Head Office pays', done: paid, at: voucher.hoPaidDate ?? inv.paidDateA, waitingFor: voucher.submittedToHoAt ? 'Head Office to pay it' : 'Finance to send the payment to Head Office' },
        ]
        : [
            { key: 'CREATED', label: 'Invoice created', done: true, at: inv.createdAt, waitingFor: '' },
            { key: 'AREA', label: 'Area approval', done: areaDone, at: inv.areaApprovedAt, waitingFor: `${areaWho} to approve it` },
            { key: 'FINANCE_APPROVAL', label: 'Finance approval', done: ospApproved || audited, at: inv.ospDecisionAt, waitingFor: 'Finance to approve it' },
            { key: 'HO_PAYMENT', label: 'Paid', done: paid, at: voucher.hoPaidDate ?? inv.paidDateA, waitingFor: 'Finance to pay it' },
        ];

    let currentIdx = defs.findIndex((d) => !d.done);
    if (cancelled) currentIdx = -1;
    const steps: TrackStep[] = defs.map((d, i) => ({
        key: d.key, label: d.label, at: iso(d.at), note: d.note ?? null,
        state: cancelled ? (d.done ? 'done' : 'cancelled') : d.done ? 'done' : i === currentIdx ? 'current' : 'waiting',
    }));
    const finished = !cancelled && currentIdx === -1;
    const current = currentIdx >= 0 ? defs[currentIdx] : null;
    const stepNumber = cancelled ? defs.filter((d) => d.done).length : finished ? defs.length : currentIdx + 1;
    const headline = cancelled ? 'Cancelled'
        : finished ? 'Paid'
            : `Waiting for ${current!.waitingFor} (step ${stepNumber} of ${defs.length})`;
    return {
        flow: osp ? 'OSP_CHAIN' : 'LEGACY', steps, currentKey: current?.key ?? null, stepNumber, totalSteps: defs.length, finished, cancelled, headline,
        waitingFor: current ? current.waitingFor : null,
        retentionHeld: !cancelled && (inv.statusB ?? 'HOLD') !== 'PAID',
    };
}
