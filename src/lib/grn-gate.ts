/**
 * The rules a goods receipt (GRN) must meet, in one place for the screen and the server (owner, 27 Nov 2026: the screen showed
 * a GRN as fine and the server refused it later). The GRN form lists these checks live in its Gate panel and keeps
 * "Confirm receipt" locked until all pass; grn.service.ts and supplier-invoice.service.ts refuse the same things.
 */

export const GRN_REJECT_REASON_MIN = 3;
export const ORACLE_GRN_MIN = 3;

const r2 = (n: number) => Math.round(n * 100) / 100;

/** The vendor invoice of a GRN may not be above the PO value of the accepted goods (rounding to the cent allowed). */
export function isGrnInvoiceAbovePo(invoiceGoods: number, poValueOfAccepted: number): boolean {
    return r2(invoiceGoods) > r2(poValueOfAccepted) + 0.01;
}

/** Segregation of duties: the person who recorded a purchase order does not receive its goods (administrators excepted). */
export function grnSodBlocked(receiverId: string | null | undefined, poRecordedById: string | null | undefined, isAdmin = false): boolean {
    return !isAdmin && !!receiverId && !!poRecordedById && receiverId === poRecordedById;
}

export interface GrnGateLine {
    name: string;
    unit?: string;
    /** still open on the PO line (ordered - received); null when the GRN is not against one PO */
    open: number | null;
    /** PO unit price, for the PO value of the accepted goods */
    unitPrice: number | null;
    accepted: number;
    rejected: number;
    rejectReason: string;
    serialsNeeded?: number;
    serialsGiven?: number;
}

export interface GrnGateInput {
    /** the request has purchase orders approved in HO: the delivery is received against one of them */
    poRequired: boolean;
    poChosen: boolean;
    /** the chosen PO was approved in the HO system: Oracle GRN number and the vendor invoice are required */
    hoOrder: boolean;
    receiverId: string | null;
    poRecordedById: string | null;
    isAdmin?: boolean;
    lines: GrnGateLine[];
    oracleGrnNumber: string;
    invoiceNumber: string;
    invoiceDate: string;
    invoiceGoods: number | null;
    invoiceTax: number | null;
    scanAttached: boolean;
}

export interface GrnCheck { key: string; ok: boolean; text: string }

const qty = (n: number, unit?: string) => `${Number(n.toFixed(4)).toLocaleString('en-LK')}${unit ? ' ' + unit : ''}`;
const rs = (n: number) => `Rs. ${r2(n).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** The PO value of what is being accepted (accepted x PO price). */
export function poValueOfAccepted(lines: GrnGateLine[]): number {
    return r2(lines.reduce((a, l) => a + (l.unitPrice ?? 0) * Math.max(0, l.accepted), 0));
}

/** Every check of a GRN, in the order a person fills the form. All ok = the server will accept it. */
export function grnGateChecks(i: GrnGateInput): GrnCheck[] {
    const out: GrnCheck[] = [];
    if (i.poRequired) out.push({ key: 'po', ok: i.poChosen, text: i.poChosen ? 'Purchase order chosen' : 'Choose the purchase order this delivery is for' });
    if (i.poChosen) {
        const blocked = grnSodBlocked(i.receiverId, i.poRecordedById, i.isAdmin);
        out.push({ key: 'sod', ok: !blocked, text: blocked ? 'You recorded this purchase order, so another person must receive its goods' : 'You did not record this purchase order' });
    }
    const accepted = i.lines.reduce((a, l) => a + Math.max(0, l.accepted), 0);
    out.push({ key: 'accepted', ok: accepted > 0, text: accepted > 0 ? `${i.lines.filter((l) => l.accepted > 0).length} item(s) accepted` : 'Accept at least one item' });
    const negative = i.lines.filter((l) => l.accepted < 0 || l.rejected < 0);
    if (negative.length) out.push({ key: 'negative', ok: false, text: 'Quantities cannot be below zero' });
    const over = i.lines.filter((l) => l.open !== null && l.accepted > l.open + 1e-9);
    if (i.lines.length) out.push({ key: 'open', ok: over.length === 0, text: over.length === 0 ? 'Accepted quantities are within what is open on the PO' : `More than is open on the PO: ${over.map((l) => `${l.name} ${qty(l.accepted, l.unit)} of ${qty(l.open!, l.unit)}`).join('; ')}` });
    const noReason = i.lines.filter((l) => l.rejected > 0 && l.rejectReason.trim().length < GRN_REJECT_REASON_MIN);
    if (i.lines.some((l) => l.rejected > 0)) out.push({ key: 'reason', ok: noReason.length === 0, text: noReason.length === 0 ? 'Every rejected quantity has its reason' : `Give the reason for the rejected ${noReason.map((l) => l.name).join(', ')}` });
    const serial = i.lines.filter((l) => (l.serialsNeeded ?? 0) > 0 && (l.serialsGiven ?? 0) !== l.serialsNeeded);
    if (i.lines.some((l) => (l.serialsNeeded ?? 0) > 0)) out.push({ key: 'serials', ok: serial.length === 0, text: serial.length === 0 ? 'Serial numbers entered' : `Enter one serial number per unit: ${serial.map((l) => `${l.name} ${l.serialsGiven ?? 0} of ${l.serialsNeeded}`).join('; ')}` });
    if (i.hoOrder) {
        out.push({ key: 'oracle', ok: i.oracleGrnNumber.trim().length >= ORACLE_GRN_MIN, text: i.oracleGrnNumber.trim().length >= ORACLE_GRN_MIN ? 'Oracle GRN number entered' : 'Enter the GRN number from the Oracle system' });
        const invOk = i.invoiceNumber.trim().length > 0 && !!i.invoiceDate && !Number.isNaN(new Date(i.invoiceDate).getTime());
        out.push({ key: 'invoice', ok: invOk, text: invOk ? 'Vendor invoice number and date entered' : 'Enter the vendor invoice number and date' });
        const valuesOk = i.invoiceGoods !== null && i.invoiceGoods >= 0 && i.invoiceTax !== null && i.invoiceTax >= 0;
        out.push({ key: 'values', ok: valuesOk, text: valuesOk ? 'Invoice goods value and tax entered' : 'Enter the invoice goods value (without tax) and the tax' });
        if (valuesOk) {
            const po = poValueOfAccepted(i.lines);
            const above = isGrnInvoiceAbovePo(i.invoiceGoods!, po);
            out.push({ key: 'price', ok: !above, text: above ? `Invoice goods ${rs(i.invoiceGoods!)} is above the PO value of the accepted goods ${rs(po)}: the vendor must invoice at the PO price` : `Invoice goods ${rs(i.invoiceGoods!)} within the PO value ${rs(po)}` });
        }
        out.push({ key: 'scan', ok: i.scanAttached, text: i.scanAttached ? 'Scanned vendor invoice attached' : 'Attach the scanned vendor invoice' });
    }
    return out;
}
