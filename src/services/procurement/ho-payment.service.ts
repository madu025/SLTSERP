import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';
import { AuditService } from '@/services/audit/audit.service';
import { LedgerService } from '@/services/finance/ledger.service';
import { ACCOUNTS } from '@/services/finance/account-codes';
import { StoreService } from '@/services/inventory/store.service';
import { NotificationService } from '@/services/notification';
import { PurchaseOrderService } from '@/services/procurement/purchase-order.service';
import { normalizePoStatus } from '@/lib/procurement-rules';
import { PAYMENT_METHODS, daysOverdue, dueDateOf, outstanding, owedForReceived, paidTotal, payableTotal, recordingCapError, splitPayment, type PayableState } from '@/lib/po-payables';

const num = (v: unknown) => Number(v ?? 0);
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export interface RecordHoPaymentInput {
    poId: string; userId: string; amount: number; paidDate: string; reference: string;
    method?: string | null; invoiceRef?: string | null; remarks?: string | null;
}

type PoForPayables = { orderDate: Date; paymentBasis: string | null; creditDays: number | null; paymentDueDate: Date | null; taxAmount: unknown; hoClearedAmount: unknown; hoAdvanceAmount: unknown; hoTaxPaid: unknown; items: { quantity: unknown; receivedQty: unknown; unitPrice: unknown }[] };

/**
 * Payments by HO to a supplier on a purchase order (HO mode): one or several parts, each recorded by the OSP Finance Officer at HO and verified by the
 * OSP Finance Manager. Only a verified payment is posted: goods received -> GR/IR, goods not yet received -> advance, tax -> input VAT, against the HO current account.
 */
export class HoPaymentService {
    static state(po: PoForPayables): PayableState {
        return {
            orderedGoods: r2(po.items.reduce((a, l) => a + num(l.quantity) * num(l.unitPrice), 0)),
            tax: r2(num(po.taxAmount)),
            receivedValue: r2(po.items.reduce((a, l) => a + num(l.receivedQty) * num(l.unitPrice), 0)),
            cleared: r2(num(po.hoClearedAmount)),
            advance: r2(num(po.hoAdvanceAmount)),
            taxPaid: r2(num(po.hoTaxPaid)),
        };
    }

    private static async loadPo(poId: string, userId: string) {
        const po = await prisma.purchaseOrder.findUnique({ where: { id: poId }, include: { items: true, stockRequest: { select: { fromStoreId: true, toStoreId: true } } } });
        if (!po) throw AppError.notFound('Purchase order not found');
        const ids = [po.stockRequest.fromStoreId, po.stockRequest.toStoreId].filter(Boolean) as string[];
        if (ids.length) {
            const stores = await StoreService.getAccessibleStores(userId);
            if (!ids.some((id) => stores.some((s) => s.id === id))) throw AppError.forbidden('STORE_SCOPE_VIOLATION: this purchase order is outside your scope');
        }
        return po;
    }

    /** First receipt date of the order (for the due date of a credit purchase). */
    private static async firstReceiptAt(poId: string): Promise<Date | null> {
        const ids = (await prisma.purchaseOrderItem.findMany({ where: { purchaseOrderId: poId }, select: { id: true } })).map((i) => i.id);
        if (!ids.length) return null;
        const first = await prisma.gRNItem.findFirst({ where: { poItemId: { in: ids } }, orderBy: { createdAt: 'asc' }, select: { createdAt: true } });
        return first?.createdAt ?? null;
    }

    static async record(input: RecordHoPaymentInput) {
        const reference = (input.reference ?? '').trim();
        if (reference.length < 3) throw AppError.badRequest('Enter the cheque or transfer reference of the HO payment');
        const paidDate = new Date(input.paidDate);
        if (Number.isNaN(paidDate.getTime()) || paidDate.getTime() > Date.now() + 86_400_000) throw AppError.badRequest('Enter a valid payment date (not in the future)');
        const method = (input.method || 'TRANSFER').toUpperCase();
        if (!(PAYMENT_METHODS as readonly string[]).includes(method)) throw AppError.badRequest('Unknown payment method');
        const amount = r2(Number(input.amount));
        const po = await this.loadPo(input.poId, input.userId);
        if (!po.hoApprovalRef) throw AppError.badRequest('HO payments are recorded on orders approved in the HO system');
        if (['CANCELLED', 'PENDING_APPROVAL', 'RETURNED'].includes(normalizePoStatus(po.status))) throw AppError.badRequest('A payment can only be recorded on an approved order');
        const invoiced = await prisma.supplierInvoice.count({ where: { storePoId: po.id, status: { in: ['AWAITING_EXECUTIVE', 'APPROVED', 'PARTIALLY_PAID', 'PAID'] } } });
        if (invoiced > 0) throw AppError.badRequest('This order was invoiced and approved in Nexus; its payable is handled there');
        const live = await prisma.hoPaymentInstallment.aggregate({ where: { purchaseOrderId: po.id, status: { in: ['RECORDED', 'VERIFIED'] } }, _sum: { amount: true } });
        const capErr = recordingCapError(amount, num(live._sum.amount), payableTotal(this.state(po)));
        if (capErr) throw AppError.badRequest(capErr);

        const row = await prisma.hoPaymentInstallment.create({
            data: { purchaseOrderId: po.id, amount, paidDate, reference, method, invoiceRef: input.invoiceRef?.trim() || null, remarks: input.remarks?.trim() || null, recordedById: input.userId },
        });
        AuditService.log({ userId: input.userId, action: 'RECORD_HO_PAYMENT', entity: 'PURCHASE_ORDER', entityId: po.id, newValue: { installmentId: row.id, amount, reference, paidDate, method } }).catch(() => undefined);
        NotificationService.notifyByAudience({
            audience: 'FINANCE_APPROVERS', title: 'HO payment to verify', type: 'FINANCE', priority: 'MEDIUM', link: `/procurement/orders/${po.id}`,
            message: `${po.poNumber} (${po.vendor}): HO paid ${amount.toLocaleString('en-US')} (${reference}). Verify it so that it is posted.`,
            metadata: { installmentId: row.id, poId: po.id }, dedupKey: `ho-payment-verify:${row.id}`,
        }).catch(() => undefined);
        return row;
    }

    /** The OSP Finance Manager confirms the payment: it is posted to the ledger, split by what it paid for. */
    static async verify(installmentId: string, userId: string) {
        const inst = await prisma.hoPaymentInstallment.findUnique({ where: { id: installmentId } });
        if (!inst || !inst.purchaseOrderId) throw AppError.notFound('Payment not found');
        if (inst.status !== 'RECORDED') throw AppError.badRequest(`This payment is already ${inst.status.toLowerCase()}`);
        if (inst.recordedById === userId) {
            AuditService.log({ userId, action: 'SOD_VIOLATION_BLOCKED', entity: 'HO_PAYMENT', entityId: inst.id, newValue: { reason: 'recorder tried to verify own HO payment' } }).catch(() => undefined);
            throw AppError.badRequest('SEGREGATION_OF_DUTIES_VIOLATION: the person who recorded a payment cannot verify it');
        }
        const po = await this.loadPo(inst.purchaseOrderId, userId);
        const amount = num(inst.amount);

        const result = await prisma.$transaction(async (tx) => {
            // the order row is locked so that two verifications cannot both use the same balance
            await tx.$executeRaw`SELECT id FROM "PurchaseOrder" WHERE id = ${po.id}::uuid FOR UPDATE`;
            const fresh = await tx.purchaseOrder.findUniqueOrThrow({ where: { id: po.id }, include: { items: true } });
            const split = splitPayment(amount, this.state(fresh));
            if (split.error !== undefined) throw AppError.badRequest(split.error);
            const claim = await tx.hoPaymentInstallment.updateMany({ where: { id: inst.id, status: 'RECORDED' }, data: { status: 'VERIFIED', verifiedById: userId, verifiedAt: new Date(), toGrir: split.toGrir, toAdvance: split.toAdvance, toTax: split.toTax } });
            if (claim.count === 0) throw AppError.conflict('This payment was just actioned by someone else');
            await tx.purchaseOrder.update({
                where: { id: po.id },
                data: {
                    hoClearedAmount: { increment: split.toGrir }, hoAdvanceAmount: { increment: split.toAdvance }, hoTaxPaid: { increment: split.toTax },
                    hoPaymentRef: inst.reference, hoPaidAt: inst.paidDate, ...(inst.invoiceRef ? { hoInvoiceRef: inst.invoiceRef } : {}),
                },
            });
            const lines = [
                ...(split.toGrir > 0 ? [{ accountCode: ACCOUNTS.AP_ACCRUED, debit: split.toGrir, credit: 0, description: `Goods received on ${po.poNumber}, paid by HO` }] : []),
                ...(split.toAdvance > 0 ? [{ accountCode: ACCOUNTS.ADVANCES, debit: split.toAdvance, credit: 0, description: `Advance to ${po.vendor} on ${po.poNumber} (goods not yet received)` }] : []),
                ...(split.toTax > 0 ? [{ accountCode: ACCOUNTS.INPUT_VAT, debit: split.toTax, credit: 0, description: `Tax on ${po.poNumber}, paid by HO` }] : []),
                { accountCode: ACCOUNTS.HO_CURRENT, debit: 0, credit: amount, description: `Owed to HO: payment ${inst.reference}` },
            ];
            const entry = await LedgerService.postTransaction(tx, {
                referenceId: po.id, referenceType: 'PURCHASE_ORDER', idempotencyKey: `HO_INSTALLMENT_${inst.id}`, isAutoGenerated: true, date: inst.paidDate,
                description: `HO paid ${po.vendor} ${amount.toFixed(2)} for ${po.poNumber} (${inst.reference})`, lines,
            });
            await tx.hoPaymentInstallment.update({ where: { id: inst.id }, data: { journalEntryId: entry?.id ?? null } });
            await PurchaseOrderService.appendApproval(tx, po.id, { stage: null, action: 'HO_PAYMENT', actorId: userId, amount: num(po.totalAmount), remarks: `HO payment ${inst.reference} of ${amount.toFixed(2)} verified: goods received ${split.toGrir.toFixed(2)}, advance ${split.toAdvance.toFixed(2)}, tax ${split.toTax.toFixed(2)}` });
            return split;
        }, { maxWait: 10_000, timeout: 30_000 });
        AuditService.log({ userId, action: 'VERIFY_HO_PAYMENT', entity: 'PURCHASE_ORDER', entityId: po.id, newValue: { installmentId: inst.id, amount, ...result } }).catch(() => undefined);
        return prisma.hoPaymentInstallment.findUniqueOrThrow({ where: { id: inst.id } });
    }

    static async reject(installmentId: string, userId: string, reason: string) {
        const text = (reason ?? '').trim();
        if (text.length < 3) throw AppError.badRequest('Give the reason for rejecting this payment record');
        const inst = await prisma.hoPaymentInstallment.findUnique({ where: { id: installmentId } });
        if (!inst || !inst.purchaseOrderId) throw AppError.notFound('Payment not found');
        await this.loadPo(inst.purchaseOrderId, userId);
        const claim = await prisma.hoPaymentInstallment.updateMany({ where: { id: inst.id, status: 'RECORDED' }, data: { status: 'REJECTED', verifiedById: userId, verifiedAt: new Date(), rejectionReason: text } });
        if (claim.count === 0) throw AppError.badRequest('Only a recorded payment that is not yet verified can be rejected');
        AuditService.log({ userId, action: 'REJECT_HO_PAYMENT', entity: 'PURCHASE_ORDER', entityId: inst.purchaseOrderId, newValue: { installmentId: inst.id, reason: text } }).catch(() => undefined);
        return prisma.hoPaymentInstallment.findUniqueOrThrow({ where: { id: inst.id } });
    }

    /** The payment schedule of one order: what it is worth, what was paid, what is waiting for verification, what is still owed, and when it is due. */
    static async schedule(poId: string, userId: string) {
        const po = await this.loadPo(poId, userId);
        const [rows, firstReceipt] = await Promise.all([
            prisma.hoPaymentInstallment.findMany({ where: { purchaseOrderId: po.id }, orderBy: { recordedAt: 'asc' } }),
            this.firstReceiptAt(po.id),
        ]);
        const ids = [...new Set(rows.flatMap((r) => [r.recordedById, r.verifiedById]).filter(Boolean) as string[])];
        const people = ids.length ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, username: true } }) : [];
        const who = new Map(people.map((p) => [p.id, p.name || p.username]));
        const s = this.state(po);
        const due = dueDateOf({ basis: po.paymentBasis, creditDays: po.creditDays, paymentDueDate: po.paymentDueDate, orderDate: po.orderDate, firstReceiptAt: firstReceipt });
        const pending = r2(rows.filter((r) => r.status === 'RECORDED').reduce((a, r) => a + num(r.amount), 0));
        return {
            terms: { basis: po.paymentBasis, creditDays: po.creditDays, typedDueDate: po.paymentDueDate, firstReceiptAt: firstReceipt, dueDate: due, daysOverdue: daysOverdue(due) },
            totals: { payable: payableTotal(s), received: s.receivedValue, paid: paidTotal(s), pendingVerification: pending, outstanding: outstanding(s), owedForReceived: owedForReceived(s), advance: s.advance },
            payments: rows.map((r) => ({
                id: r.id, amount: num(r.amount), paidDate: r.paidDate, reference: r.reference, method: r.method, invoiceRef: r.invoiceRef, remarks: r.remarks, status: r.status,
                recordedBy: who.get(r.recordedById) ?? null, verifiedBy: r.verifiedById ? who.get(r.verifiedById) ?? null : null, verifiedAt: r.verifiedAt, rejectionReason: r.rejectionReason,
                toGrir: num(r.toGrir), toAdvance: num(r.toAdvance), toTax: num(r.toTax),
            })),
        };
    }
}
