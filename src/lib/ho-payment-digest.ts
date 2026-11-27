/**
 * What OSP is told about HO's payments on OSP vendor vouchers (owner, 27 Nov 2026).
 *
 * OSP does not know when or how much HO pays a vendor: it learns it from the payments the HO Account Executive records. Each recorded payment
 * updates ONE notice per person per day ("HO payments today"), so 100 invoices paid in a day are one notice, not 100. Only the first payment
 * of the day pushes or emails; later ones update the same notice and show it unread again. The details are on Vendor Payment Status.
 */

export interface HoDayPayment {
    pvNumber: string;
    vendor: string;
    amount: number;
    reference: string;
    /** the voucher after this payment: fully paid, or what is still to pay */
    voucherPaid: boolean;
    remaining: number;
}

export type VendorPaymentState = 'PENDING' | 'PARTLY_PAID' | 'COMPLETED';

/** The state OSP sees for a voucher with HO: nothing paid yet, part paid, or fully paid. */
export function vendorPaymentState(amount: number, paid: number): VendorPaymentState {
    if (paid <= 0.005) return 'PENDING';
    return amount - paid <= 0.005 ? 'COMPLETED' : 'PARTLY_PAID';
}

export const VENDOR_PAYMENT_STATE_LABEL: Record<VendorPaymentState, string> = {
    PENDING: 'Pending (nothing paid yet)',
    PARTLY_PAID: 'Partly paid',
    COMPLETED: 'Completed',
};

/** One notice per person per Colombo day; the day key comes from lib/timezone getSriLankaDayKey. */
export const hoPaymentDigestKey = (day: string) => `ho-vendor-payments:${day}`;

const rs = (n: number) => `Rs. ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** The notice for the day so far, newest payment last. */
export function hoPaymentDigest(payments: readonly HoDayPayment[]): { title: string; message: string } {
    const total = payments.reduce((s, p) => s + p.amount, 0);
    // a voucher paid in two parts today counts once, in its latest state
    const latest = new Map<string, HoDayPayment>();
    for (const p of payments) latest.set(p.pvNumber, p);
    const vouchers = [...latest.values()];
    const completed = vouchers.filter((v) => v.voucherPaid).length;
    const partly = vouchers.filter((v) => !v.voucherPaid);
    const stillToPay = partly.reduce((s, v) => s + v.remaining, 0);
    const last = payments[payments.length - 1];
    const n = payments.length;
    const title = `HO payments today: ${n} payment${n === 1 ? '' : 's'}, ${rs(total)}`;
    const parts = [
        `HO paid ${rs(total)} on ${vouchers.length} vendor voucher${vouchers.length === 1 ? '' : 's'} today.`,
        `Completed: ${completed}.`,
        partly.length ? `Partly paid: ${partly.length} (${rs(stillToPay)} still to pay).` : '',
        last ? `Latest: ${last.pvNumber}, ${last.vendor}, ${rs(last.amount)} (${last.reference})${last.voucherPaid ? ', fully paid' : `, ${rs(last.remaining)} still to pay`}.` : '',
    ];
    return { title, message: parts.filter(Boolean).join(' ') };
}
