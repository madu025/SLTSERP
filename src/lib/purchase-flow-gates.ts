/**
 * The rules of each step of the company purchase flow, in one place for the screens and the services (owner, 27 Nov 2026:
 * "validation that cannot disagree with the server"). Each gate returns plain-English checks; a screen lists them live
 * ("Before you confirm") and keeps its action locked until all pass; the service throws the first failing one.
 * The GRN step lives in grn-gate.ts. Route and stations: PURCHASE_ROUTE / purchaseStation.
 */
import type { GrnCheck } from '@/lib/grn-gate';

export type GateCheck = GrnCheck;

const r2 = (n: number) => Math.round(n * 100) / 100;
const qty = (n: number) => Number(n.toFixed(4)).toLocaleString('en-LK');
const rs = (n: number) => `Rs. ${r2(n).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const REASON_MIN = 3;
export const REFERENCE_MIN = 3;

/** The first failing check, for the service to throw (null when all pass). */
export function firstFailure(checks: GateCheck[]): GateCheck | null {
    return checks.find((c) => !c.ok) ?? null;
}

/** Units that only come whole (a count, not a length or weight). */
export function isWholeUnit(unit: string | null | undefined): boolean {
    return ['nos', 'no', 'pcs', 'pc', 'each', 'ea', 'unit', 'units', 'set', 'sets', 'roll', 'rolls'].includes(String(unit ?? '').trim().toLowerCase());
}

// ---- 1. material request ----------------------------------------------------------------------------------------------

export interface RequestGateInput {
    storeChosen: boolean;
    purpose: string;
    /** yyyy-mm-dd; today counts as not past */
    requiredDate: string | null;
    today: string;
    lines: Array<{ key: string; name: string; unit?: string | null; quantity: number }>;
}

export function requestGate(i: RequestGateInput): GateCheck[] {
    const out: GateCheck[] = [];
    out.push({ key: 'store', ok: i.storeChosen, text: i.storeChosen ? 'Store chosen' : 'Choose the store the request is for' });
    out.push({ key: 'items', ok: i.lines.length > 0, text: i.lines.length > 0 ? `${i.lines.length} item(s) on the request` : 'Add at least one item' });
    const seen = new Set<string>();
    const dup = i.lines.filter((l) => (seen.has(l.key) ? true : (seen.add(l.key), false)));
    if (i.lines.length) out.push({ key: 'duplicate', ok: dup.length === 0, text: dup.length === 0 ? 'No item listed twice' : `Listed twice: ${dup.map((l) => l.name).join(', ')} (put the total on one line)` });
    const bad = i.lines.filter((l) => !(l.quantity > 0) || (isWholeUnit(l.unit) && !Number.isInteger(l.quantity)));
    if (i.lines.length) out.push({ key: 'quantity', ok: bad.length === 0, text: bad.length === 0 ? 'Every quantity is above zero' : `Enter a quantity above zero${bad.some((l) => isWholeUnit(l.unit) && l.quantity > 0) ? ' (whole numbers for items counted in Nos)' : ''}: ${bad.map((l) => l.name).join(', ')}` });
    const past = !!i.requiredDate && i.requiredDate < i.today;
    out.push({ key: 'date', ok: !!i.requiredDate && !past, text: !i.requiredDate ? 'Enter the date the items are needed' : past ? 'The required date is in the past: choose today or later' : 'Required date set' });
    out.push({ key: 'purpose', ok: i.purpose.trim().length >= REASON_MIN, text: i.purpose.trim().length >= REASON_MIN ? 'Purpose given' : 'Say what the items are for' });
    return out;
}

// ---- 2 and 3. approvals (Stores Manager review, OSP Manager approval) -----------------------------------------------

export interface ApprovalGateInput {
    actorId: string | null;
    requesterId: string | null;
    /** people who already signed an earlier step of this request */
    earlierSignerIds: Array<string | null | undefined>;
    /** the request is waiting at this step (pending, this stage) */
    waitingHere: boolean;
    rejecting: boolean;
    reason: string;
    lines: Array<{ name: string; requested: number; approved: number }>;
    isAdmin?: boolean;
}

export function approvalSodBlocked(i: Pick<ApprovalGateInput, 'actorId' | 'requesterId' | 'earlierSignerIds' | 'isAdmin'>): 'requester' | 'earlier' | null {
    if (i.isAdmin || !i.actorId) return null;
    if (i.requesterId && i.actorId === i.requesterId) return 'requester';
    if (i.earlierSignerIds.some((s) => s && s === i.actorId)) return 'earlier';
    return null;
}

export function approvalGate(i: ApprovalGateInput): GateCheck[] {
    const out: GateCheck[] = [];
    out.push({ key: 'stage', ok: i.waitingHere, text: i.waitingHere ? 'The request is waiting for this step' : 'This request is not waiting for this step (an earlier step is still open, or it was already actioned)' });
    const sod = approvalSodBlocked(i);
    out.push({ key: 'sod', ok: sod === null, text: sod === 'requester' ? 'You raised this request, so another person reviews it' : sod === 'earlier' ? 'You signed an earlier step of this request, so another person signs this one' : 'You did not raise or sign this request before' });
    if (!i.rejecting) {
        const over = i.lines.filter((l) => l.approved > l.requested + 1e-9 || l.approved < 0);
        out.push({ key: 'approved', ok: over.length === 0, text: over.length === 0 ? 'Approved quantities are within what was requested' : `Approve at most what was requested: ${over.map((l) => `${l.name} ${qty(l.approved)} of ${qty(l.requested)}`).join('; ')}` });
        const nothing = i.lines.length > 0 && i.lines.every((l) => !(l.approved > 0));
        if (nothing) out.push({ key: 'nothing', ok: false, text: 'Nothing is approved: reject the request instead' });
    }
    const reduced = i.lines.some((l) => l.approved < l.requested - 1e-9);
    if (i.rejecting || reduced) out.push({ key: 'reason', ok: i.reason.trim().length >= REASON_MIN, text: i.reason.trim().length >= REASON_MIN ? 'Reason given' : i.rejecting ? 'Say why the request is rejected' : 'Say why the quantity is reduced' });
    return out;
}

// ---- 4. documents to Procurement ------------------------------------------------------------------------------------

export function docsGate(i: { approved: boolean; alreadySubmitted: boolean }): GateCheck[] {
    return [
        { key: 'approved', ok: i.approved, text: i.approved ? 'The request is approved and with Procurement' : 'Only an approved request can be handed to Procurement' },
        { key: 'once', ok: !i.alreadySubmitted, text: i.alreadySubmitted ? 'The documents were already submitted' : 'The documents have not been submitted yet' },
    ];
}

// ---- 5. purchase order ----------------------------------------------------------------------------------------------

export interface PoGateInput {
    docsIn: boolean;
    vendorChosen: boolean;
    lines: Array<{ name: string; open: number; quantity: number; unitPrice: number }>;
    basis: string;
    creditDays: number | null;
    dueDate: string | null;
}

export function poGate(i: PoGateInput): GateCheck[] {
    const out: GateCheck[] = [];
    out.push({ key: 'docs', ok: i.docsIn, text: i.docsIn ? 'The documents are with Procurement' : 'Wait for the Stores Manager to submit the documents' });
    out.push({ key: 'vendor', ok: i.vendorChosen, text: i.vendorChosen ? 'Vendor chosen' : 'Choose the vendor HO approved' });
    const ordered = i.lines.filter((l) => l.quantity > 0);
    out.push({ key: 'lines', ok: ordered.length > 0, text: ordered.length > 0 ? `${ordered.length} line(s) on the order` : 'Order at least one item' });
    const over = ordered.filter((l) => l.quantity > l.open + 1e-9);
    if (ordered.length) out.push({ key: 'open', ok: over.length === 0, text: over.length === 0 ? 'Quantities within what is still to order' : `More than is still to order: ${over.map((l) => `${l.name} ${qty(l.quantity)} of ${qty(l.open)}`).join('; ')}` });
    const noPrice = ordered.filter((l) => !(l.unitPrice > 0));
    if (ordered.length) out.push({ key: 'price', ok: noPrice.length === 0, text: noPrice.length === 0 ? 'Every line has the HO-approved unit price' : `Enter the HO-approved unit price: ${noPrice.map((l) => l.name).join(', ')}` });
    const credit = i.basis === 'CREDIT';
    const termsOk = !credit || (i.creditDays !== null && i.creditDays > 0) || !!i.dueDate;
    out.push({ key: 'terms', ok: !!i.basis && termsOk, text: !i.basis ? 'Choose how the order is paid' : termsOk ? 'Payment terms set' : 'Enter the credit days or the due date from the HO document' });
    return out;
}

/** Every approved line fully on live purchase orders: the request is ready for the GRN by itself. */
export function fullyOrdered(lines: Array<{ approved: number; ordered: number }>): boolean {
    return lines.length > 0 && lines.every((l) => l.ordered >= l.approved - 1e-9);
}

// ---- 7. payment voucher ---------------------------------------------------------------------------------------------

export function voucherGate(i: { invoiceApprovedOrMatched: boolean; hasVoucher: boolean; amount: number; invoiceTotal: number }): GateCheck[] {
    return [
        { key: 'invoice', ok: i.invoiceApprovedOrMatched, text: i.invoiceApprovedOrMatched ? 'The vendor invoice matches the PO and GRN' : 'The vendor invoice does not match the PO and GRN: a finance approver deals with it first' },
        { key: 'one', ok: !i.hasVoucher, text: i.hasVoucher ? 'This invoice already has a voucher' : 'No voucher yet for this invoice' },
        { key: 'amount', ok: Math.abs(r2(i.amount) - r2(i.invoiceTotal)) < 0.01, text: Math.abs(r2(i.amount) - r2(i.invoiceTotal)) < 0.01 ? `Amount equals the invoice total ${rs(i.invoiceTotal)}` : `The voucher amount must equal the invoice total ${rs(i.invoiceTotal)}` },
    ];
}

// ---- 8. signatures --------------------------------------------------------------------------------------------------

/**
 * Recording "Signed by all three": the Account Manager, OSP Manager and Head of Section sign the printed voucher, and the OSP Account
 * Officer (who raised it) records it with the scan; the paper signatures are the segregation of duties here, so the maker may record them.
 * An invoice that does not match the PO and GRN (a variance, or above the PO price) is dealt with by a finance approver first.
 */
export function signaturesGate(i: { scanAttached: boolean; invoiceMatches: boolean }): GateCheck[] {
    return [
        { key: 'scan', ok: i.scanAttached, text: i.scanAttached ? 'Scan of the signed voucher attached' : 'Attach the scan of the voucher signed by the Account Manager, OSP Manager and Head of Section' },
        { key: 'match', ok: i.invoiceMatches, text: i.invoiceMatches ? 'The vendor invoice matches the PO and GRN' : 'The vendor invoice does not match the PO and GRN: a finance approver deals with it on Supplier Invoices first' },
    ];
}

/** "Not signed" / "Documents not received": the reason goes back to the OSP Account. */
export function reasonGate(reason: string, what: string): GateCheck[] {
    return [{ key: 'reason', ok: reason.trim().length >= REASON_MIN, text: reason.trim().length >= REASON_MIN ? 'Reason given' : `Say ${what}` }];
}

// ---- 9. documents sent / received -----------------------------------------------------------------------------------

export function docsChainGate(i: { step: 'SENT' | 'RECEIVED'; voucherApproved: boolean; docsStatus: string | null; canReceive: boolean }): GateCheck[] {
    if (i.step === 'SENT') return [
        { key: 'signed', ok: i.voucherApproved, text: i.voucherApproved ? 'The voucher is signed' : 'Record the signatures first' },
        { key: 'state', ok: i.docsStatus === 'TO_SEND' || i.docsStatus === 'NOT_RECEIVED', text: i.docsStatus === 'SENT' ? 'The documents were already sent' : 'The documents are ready to send' },
    ];
    return [
        { key: 'who', ok: i.canReceive, text: i.canReceive ? 'You record HO payments' : 'Only the HO Account Executive marks the documents received' },
        { key: 'sent', ok: i.docsStatus === 'SENT', text: i.docsStatus === 'SENT' ? 'The OSP Account sent the documents' : 'The documents have not been sent yet' },
    ];
}

// ---- 10. HO payments ------------------------------------------------------------------------------------------------

export interface HoPaymentGateInput { amount: number | null; balance: number; reference: string; paidDate: string | null; today: string; withHo: boolean }

export function hoPaymentGate(i: HoPaymentGateInput): GateCheck[] {
    const amountOk = i.amount !== null && i.amount > 0 && r2(i.amount) <= r2(i.balance) + 0.001;
    return [
        { key: 'ho', ok: i.withHo, text: i.withHo ? 'The voucher is with HO' : 'The voucher documents have not reached HO yet' },
        { key: 'amount', ok: amountOk, text: i.amount === null || !(i.amount > 0) ? `Enter the amount HO paid (up to ${rs(i.balance)})` : amountOk ? `${rs(i.amount)} of ${rs(i.balance)} still to pay` : `The amount is more than is still to pay (${rs(i.balance)})` },
        { key: 'reference', ok: i.reference.trim().length >= REFERENCE_MIN, text: i.reference.trim().length >= REFERENCE_MIN ? 'Cheque or transfer reference entered' : 'Enter the cheque or transfer reference' },
        { key: 'date', ok: !!i.paidDate && i.paidDate <= i.today, text: !i.paidDate ? 'Enter the date HO paid' : i.paidDate > i.today ? 'The payment date cannot be in the future' : 'Payment date set' },
    ];
}

// ---- the request's route --------------------------------------------------------------------------------------------

export const PURCHASE_ROUTE = [
    { key: 'REQUEST', label: 'Request', who: 'Stores Officer' },
    { key: 'STORES_MANAGER', label: 'Stores Manager', who: 'Stores Manager' },
    { key: 'OSP_MANAGER', label: 'OSP Manager', who: 'OSP Manager' },
    { key: 'DOCUMENTS', label: 'Documents', who: 'Stores Manager' },
    { key: 'PO', label: 'PO', who: 'Procurement Officer' },
    { key: 'GRN', label: 'GRN', who: 'Stores Manager' },
    { key: 'VOUCHER', label: 'Voucher', who: 'OSP Account Officer' },
    { key: 'HO_PAID', label: 'HO paid', who: 'HO Account Executive' },
] as const;
export type PurchaseStation = (typeof PURCHASE_ROUTE)[number]['key'] | 'DONE' | 'CLOSED';

/** Where a purchase request stands now (the station it waits at). */
export function purchaseStation(r: {
    status?: string | null; workflowStage?: string | null; procurementDocsSubmittedAt?: string | Date | null;
    hasGrn?: boolean; voucherStatus?: string | null; voucherPaid?: boolean;
}): PurchaseStation {
    const status = String(r.status ?? '').toUpperCase();
    const stage = String(r.workflowStage ?? '').toUpperCase();
    if (['REJECTED', 'CANCELLED'].includes(status) || stage === 'REJECTED') return 'CLOSED';
    if (r.voucherPaid) return 'DONE';
    if (r.voucherStatus) return 'HO_PAID';
    if (r.hasGrn && stage === 'COMPLETED') return 'VOUCHER';
    if (stage === 'GRN_PENDING' || stage === 'STORE_RECEIVING' || stage === 'COMPLETED') return r.hasGrn ? 'VOUCHER' : 'GRN';
    if (stage === 'PROCUREMENT' || stage === 'PROCUREMENT_PROCESSING') return r.procurementDocsSubmittedAt ? 'PO' : 'DOCUMENTS';
    if (stage.includes('OSP') || stage === 'HOS_APPROVAL') return 'OSP_MANAGER';
    if (stage.includes('STORES_MANAGER')) return 'STORES_MANAGER';
    return 'REQUEST';
}
