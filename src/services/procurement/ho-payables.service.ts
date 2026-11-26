import { prisma } from '@/lib/prisma';
import { daysOverdue, dueDateOf } from '@/lib/po-payables';

const num = (v: unknown) => Number(v ?? 0);
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export interface HoOrderPayable {
    poId: string; poNumber: string; vendorId: string | null; vendor: string;
    /** Goods received at the PO price, and when each receipt happened */
    receipts: { date: Date; grnNumber: string; value: number }[];
    /** Verified HO payments: the part that paid for goods (GR/IR + advance) */
    payments: { date: Date; reference: string; goods: number; tax: number }[];
    received: number; paidForGoods: number; owedForReceived: number;
    dueDate: Date | null; daysOverdue: number | null;
}

/**
 * Orders approved in the HO system (HO mode) as payables: goods received at the PO price against what HO paid for goods.
 * The supplier's tax is paid by HO with the goods and is not part of what OSP owes the supplier.
 */
export class HoPayablesService {
    static async orders(filter: { vendorId?: string } = {}, today = new Date()): Promise<HoOrderPayable[]> {
        const pos = await prisma.purchaseOrder.findMany({
            where: { hoApprovalRef: { not: null }, status: { not: 'CANCELLED' }, ...(filter.vendorId ? { vendorId: filter.vendorId } : {}) },
            select: {
                id: true, poNumber: true, vendorId: true, vendor: true, orderDate: true, paymentBasis: true, creditDays: true, paymentDueDate: true, hoClearedAmount: true, hoAdvanceAmount: true,
                items: { select: { id: true } },
                hoPayments: { where: { status: 'VERIFIED' }, select: { paidDate: true, reference: true, toGrir: true, toAdvance: true, toTax: true } },
            },
            take: 2000,
        });
        if (!pos.length) return [];
        const lineToPo = new Map<string, string>();
        for (const p of pos) for (const l of p.items) lineToPo.set(l.id, p.id);
        const grnLines = await prisma.gRNItem.findMany({ where: { poItemId: { in: [...lineToPo.keys()] } }, select: { poItemId: true, quantity: true, unitPrice: true, createdAt: true, grn: { select: { grnNumber: true } } } });
        const receiptsByPo = new Map<string, { date: Date; grnNumber: string; value: number }[]>();
        for (const g of grnLines) {
            const poId = lineToPo.get(g.poItemId as string)!;
            const list = receiptsByPo.get(poId) ?? [];
            list.push({ date: g.createdAt, grnNumber: g.grn.grnNumber, value: r2(num(g.quantity) * num(g.unitPrice)) });
            receiptsByPo.set(poId, list);
        }
        return pos.map((p) => {
            const receipts = (receiptsByPo.get(p.id) ?? []).sort((a, b) => a.date.getTime() - b.date.getTime());
            const received = r2(receipts.reduce((a, r) => a + r.value, 0));
            const payments = p.hoPayments.map((x) => ({ date: x.paidDate, reference: x.reference, goods: r2(num(x.toGrir) + num(x.toAdvance)), tax: num(x.toTax) }));
            const paidForGoods = r2(num(p.hoClearedAmount) + num(p.hoAdvanceAmount));
            const due = dueDateOf({ basis: p.paymentBasis, creditDays: p.creditDays, paymentDueDate: p.paymentDueDate, orderDate: p.orderDate, firstReceiptAt: receipts[0]?.date ?? null });
            return {
                poId: p.id, poNumber: p.poNumber, vendorId: p.vendorId, vendor: p.vendor, receipts, payments, received, paidForGoods,
                owedForReceived: Math.max(0, r2(received - num(p.hoClearedAmount))), dueDate: due, daysOverdue: daysOverdue(due, today),
            };
        });
    }
}
