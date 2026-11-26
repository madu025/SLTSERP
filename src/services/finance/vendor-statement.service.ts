import { prisma } from '@/lib/prisma';

export interface StatementLine {
    date: string;
    type: 'INVOICE' | 'PAYMENT' | 'DEBIT_NOTE';
    reference: string;
    detail: string;
    /** Increases what we owe the vendor */
    debit: number;
    /** Reduces what we owe the vendor */
    credit: number;
    balance: number;
}

export interface VendorStatement {
    vendor: { id: string; code: string; name: string; paymentTerms: string | null };
    lines: StatementLine[];
    totals: { invoiced: number; paid: number; debitNotes: number; balance: number };
    overdue: number;
}

export interface VendorBalanceRow { vendorId: string; code: string; name: string; invoiced: number; paid: number; debitNotes: number; balance: number }

const num = (v: unknown) => Number(v ?? 0);
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Vendor statement: what we were invoiced, what we paid (paid vendor payment vouchers, gross of withholding tax) and
 * what debit notes reduced, in date order with a running balance. The balance is what we still owe the vendor and is
 * the same figure the AP aging report shows for that vendor.
 */
export class VendorStatementService {
    static async getStatement(vendorId: string): Promise<VendorStatement | null> {
        const vendor = await prisma.vendor.findUnique({ where: { id: vendorId }, select: { id: true, code: true, name: true, paymentTerms: true } });
        if (!vendor) return null;
        const [invoices, payments, notes] = await Promise.all([
            prisma.supplierInvoice.findMany({ where: { vendorId, status: { in: ['APPROVED', 'PARTIALLY_PAID', 'PAID'] } }, select: { invoiceNumber: true, invoiceDate: true, totalAmount: true, dueDate: true, paidAmount: true, approvedAt: true } }),
            prisma.paymentVoucher.findMany({ where: { vendorId, status: 'PAID' }, select: { pvNumber: true, paidAt: true, amount: true, taxWithheld: true } }),
            prisma.supplierDebitNote.findMany({ where: { vendorId }, select: { noteNumber: true, createdAt: true, amount: true, taxAmount: true, reason: true } }),
        ]);

        type Raw = { date: Date; type: StatementLine['type']; reference: string; detail: string; debit: number; credit: number };
        const raw: Raw[] = [
            ...invoices.map((i) => ({ date: i.invoiceDate, type: 'INVOICE' as const, reference: i.invoiceNumber, detail: i.dueDate ? `Due ${i.dueDate.toISOString().slice(0, 10)}` : '', debit: num(i.totalAmount), credit: 0 })),
            ...payments.map((p) => ({ date: p.paidAt ?? new Date(0), type: 'PAYMENT' as const, reference: p.pvNumber, detail: num(p.taxWithheld) > 0 ? `Withholding tax ${round2(num(p.taxWithheld))}` : '', debit: 0, credit: num(p.amount) })),
            ...notes.map((n) => ({ date: n.createdAt, type: 'DEBIT_NOTE' as const, reference: n.noteNumber, detail: n.reason ?? '', debit: 0, credit: num(n.amount) + num(n.taxAmount) })),
        ].sort((a, b) => a.date.getTime() - b.date.getTime());

        let balance = 0;
        const lines: StatementLine[] = raw.map((r) => {
            balance = round2(balance + r.debit - r.credit);
            return { date: r.date.toISOString().slice(0, 10), type: r.type, reference: r.reference, detail: r.detail, debit: r.debit, credit: r.credit, balance };
        });
        const now = Date.now();
        const overdue = round2(invoices.filter((i) => i.dueDate && i.dueDate.getTime() < now && num(i.paidAmount) < num(i.totalAmount)).reduce((a, i) => a + num(i.totalAmount) - num(i.paidAmount), 0));
        return {
            vendor, lines, overdue,
            totals: {
                invoiced: round2(raw.reduce((a, r) => a + (r.type === 'INVOICE' ? r.debit : 0), 0)),
                paid: round2(raw.reduce((a, r) => a + (r.type === 'PAYMENT' ? r.credit : 0), 0)),
                debitNotes: round2(raw.reduce((a, r) => a + (r.type === 'DEBIT_NOTE' ? r.credit : 0), 0)),
                balance,
            },
        };
    }

    /** One row per vendor that has any approved invoice, for the statement list. */
    static async listBalances(): Promise<VendorBalanceRow[]> {
        const [inv, paid, notes] = await Promise.all([
            prisma.supplierInvoice.groupBy({ by: ['vendorId'], where: { status: { in: ['APPROVED', 'PARTIALLY_PAID', 'PAID'] } }, _sum: { totalAmount: true } }),
            prisma.paymentVoucher.groupBy({ by: ['vendorId'], where: { status: 'PAID', vendorId: { not: null } }, _sum: { amount: true } }),
            prisma.supplierDebitNote.groupBy({ by: ['vendorId'], _sum: { amount: true, taxAmount: true } }),
        ]);
        const ids = inv.map((i) => i.vendorId);
        const vendors = ids.length ? await prisma.vendor.findMany({ where: { id: { in: ids } }, select: { id: true, code: true, name: true } }) : [];
        const paidBy = new Map(paid.map((p) => [p.vendorId as string, num(p._sum.amount)]));
        const noteBy = new Map(notes.map((n) => [n.vendorId, num(n._sum.amount) + num(n._sum.taxAmount)]));
        return vendors.map((v) => {
            const invoiced = num(inv.find((i) => i.vendorId === v.id)?._sum.totalAmount);
            const p = paidBy.get(v.id) ?? 0;
            const dn = noteBy.get(v.id) ?? 0;
            return { vendorId: v.id, code: v.code, name: v.name, invoiced: round2(invoiced), paid: round2(p), debitNotes: round2(dn), balance: round2(invoiced - p - dn) };
        }).sort((a, b) => b.balance - a.balance);
    }
}
