import { hoPaymentGate, firstFailure } from '@/lib/purchase-flow-gates';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';
import { AuditService } from '@/services/audit/audit.service';
import { LedgerService } from '@/services/finance/ledger.service';
import { ACCOUNTS } from '@/services/finance/account-codes';
import { PAYMENT_METHODS } from '@/lib/po-payables';
import { getSriLankaDayKey } from '@/lib/timezone';
import { hoPaymentDigest, hoPaymentDigestKey, vendorPaymentState, type HoDayPayment } from '@/lib/ho-payment-digest';
import { NotificationService } from '@/services/notification';

const num = (v: unknown) => Number(v ?? 0);
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export interface RecordVoucherPaymentInput {
    voucherId: string; userId: string; amount: number; paidDate: string; reference: string; method?: string | null; remarks?: string | null;
}

/**
 * Payments HO makes on an OSP payment voucher for a vendor invoice, in full or in parts (HO decides by the funds it has). The Account Executive
 * at HO records each one; it is posted at once (Vendor payable AP-VEND-2010 debit, HO current HO-2020 credit), the supplier invoice moves to
 * PARTIALLY_PAID / PAID, and the voucher becomes PAID when the parts reach its amount.
 * A voucher with withholding tax or retention is paid in one go (its deductions are booked by the normal full-payment posting).
 */
export class HoPaymentService {
    static async record(input: RecordVoucherPaymentInput) {
        const reference = (input.reference ?? '').trim();
        if (reference.length < 3) throw AppError.badRequest('Enter the cheque or transfer reference of the HO payment');
        const paidDate = new Date(input.paidDate);
        if (Number.isNaN(paidDate.getTime()) || paidDate.getTime() > Date.now() + 86_400_000) throw AppError.badRequest('Enter a valid payment date (not in the future)');
        const method = (input.method || 'TRANSFER').toUpperCase();
        if (!(PAYMENT_METHODS as readonly string[]).includes(method)) throw AppError.badRequest('Unknown payment method');
        const amount = r2(Number(input.amount));
        if (!(amount > 0)) throw AppError.badRequest('The amount must be greater than zero');

        const pv = await prisma.paymentVoucher.findUnique({ where: { id: input.voucherId } });
        if (!pv) throw AppError.notFound('Payment voucher not found');
        if (!pv.supplierInvoiceId) throw AppError.badRequest('Part payments are recorded on vendor payment vouchers');
        if (pv.status !== 'SUBMITTED_TO_HO') throw AppError.badRequest('Payments are recorded on a voucher that is with Head Office');
        if (pv.createdById === input.userId || pv.approvedById === input.userId) {
            AuditService.log({ userId: input.userId, action: 'SOD_VIOLATION_BLOCKED', entity: 'PAYMENT_VOUCHER', entityId: pv.id, newValue: { reason: 'maker or approver tried to record the HO payment' } }).catch(() => undefined);
            throw AppError.badRequest('SEGREGATION_OF_DUTIES_VIOLATION: the person who raised or accepted a voucher cannot record its payment');
        }
        const remaining = r2(num(pv.amount) - num(pv.hoPaidAmount));
        // the same checks the payment form shows (lib/purchase-flow-gates.ts)
        const gateFailed = firstFailure(hoPaymentGate({ amount, balance: remaining, reference, paidDate: String(input.paidDate).slice(0, 10), today: new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10), withHo: true }));
        if (gateFailed) throw AppError.badRequest(gateFailed.text);
        if (amount > remaining + 0.005) throw AppError.badRequest(`This payment (${amount.toFixed(2)}) is more than is still to pay on the voucher (${remaining.toFixed(2)})`);
        const hasDeductions = num(pv.taxWithheld) > 0 || num(pv.retentionAmount) > 0;
        if (hasDeductions && Math.abs(amount - remaining) > 0.005) throw AppError.badRequest('This voucher has withholding tax or retention: HO pays it in one payment of the full amount');
        const completes = Math.abs(amount - remaining) <= 0.005;

        const row = await prisma.$transaction(async (tx) => {
            await tx.$queryRaw`SELECT "id" FROM "PaymentVoucher" WHERE "id" = ${pv.id}::uuid FOR UPDATE`;
            await tx.$queryRaw`SELECT "id" FROM "SupplierInvoice" WHERE "id" = ${pv.supplierInvoiceId}::uuid FOR UPDATE`;
            const fresh = await tx.paymentVoucher.findUniqueOrThrow({ where: { id: pv.id } });
            if (fresh.status !== 'SUBMITTED_TO_HO' || r2(num(fresh.hoPaidAmount)) !== r2(num(pv.hoPaidAmount))) throw AppError.conflict('This voucher was just paid by someone else; reload and try again');

            const inst = await tx.hoPaymentInstallment.create({
                data: { paymentVoucherId: pv.id, amount, paidDate, reference, method, remarks: input.remarks?.trim() || null, status: 'POSTED', recordedById: input.userId, verifiedById: input.userId, verifiedAt: new Date() },
            });
            let entryId: string | null = null;
            if (hasDeductions) {
                // a voucher with deductions is paid in one go: the normal posting books withholding tax and retention as well
                const entry = await LedgerService.logPaymentVoucherPayment(tx as never, pv.id, num(pv.amount), pv.type || 'VENDOR', pv.pvNumber, pv.payeeName, undefined,
                    { taxWithheld: num(pv.taxWithheld), retentionAmount: num(pv.retentionAmount), releasesRetention: !!pv.retentionReleaseId });
                entryId = (entry as { id?: string } | null)?.id ?? null;
            } else {
                const entry = await LedgerService.postTransaction(tx, {
                    referenceId: pv.id, referenceType: 'PV_PAYMENT', idempotencyKey: `PV_INSTALLMENT_${inst.id}`, isAutoGenerated: true, date: paidDate,
                    description: `HO paid ${pv.payeeName} ${amount.toFixed(2)} on PV ${pv.pvNumber} (${reference})`,
                    lines: [
                        { accountCode: ACCOUNTS.AP_VENDOR, debit: amount, credit: 0, description: `Payment to ${pv.payeeName} on PV ${pv.pvNumber}` },
                        { accountCode: ACCOUNTS.HO_CURRENT, debit: 0, credit: amount, description: `Paid by Head Office: ${reference}` },
                    ],
                });
                entryId = entry?.id ?? null;
            }
            await tx.hoPaymentInstallment.update({ where: { id: inst.id }, data: { journalEntryId: entryId, toGrir: amount } });

            const si = await tx.supplierInvoice.findUniqueOrThrow({ where: { id: pv.supplierInvoiceId! } });
            const paid = new Prisma.Decimal(si.paidAmount).plus(amount);
            if (paid.gt(new Prisma.Decimal(si.totalAmount).plus('0.005'))) throw AppError.badRequest('SUPPLIER_INVOICE_PAYMENT_EXCEEDS_TOTAL');
            const settled = paid.gte(new Prisma.Decimal(si.totalAmount).minus('0.005'));
            await tx.supplierInvoice.update({ where: { id: si.id }, data: { paidAmount: paid, status: settled ? 'PAID' : 'PARTIALLY_PAID', paidAt: settled ? paidDate : null } });

            await tx.paymentVoucher.update({
                where: { id: pv.id },
                data: {
                    hoPaidAmount: { increment: amount }, hoReference: reference, hoPaidDate: paidDate,
                    ...(completes ? { status: 'PAID', paidById: input.userId, confirmedById: input.userId, paidAt: new Date(), paymentDate: paidDate } : {}),
                },
            });
            return inst;
        }, { maxWait: 10_000, timeout: 30_000 });
        AuditService.log({ userId: input.userId, action: 'RECORD_HO_PAYMENT', entity: 'PAYMENT_VOUCHER', entityId: pv.id, newValue: { installmentId: row.id, amount, reference, paidDate, completes } }).catch(() => undefined);
        // one notice per person per day for the OSP signers and the finance team, updated with each payment (lib/ho-payment-digest.ts)
        this.notifyDay().catch(() => undefined);
        return row;
    }

    /** Today's HO payments as one running notice: OSP (Account Manager, OSP Manager, Head of Section) and the finance team. */
    static async notifyDay(now = new Date()) {
        const day = getSriLankaDayKey(now);
        const start = new Date(`${day}T00:00:00+05:30`);
        const today = await prisma.hoPaymentInstallment.findMany({
            where: { recordedAt: { gte: start }, paymentVoucherId: { not: null } },
            orderBy: { recordedAt: 'asc' },
            select: { amount: true, reference: true, paymentVoucherId: true },
        });
        const pvIds = [...new Set(today.map((r) => r.paymentVoucherId!))];
        const pvs = await prisma.paymentVoucher.findMany({ where: { id: { in: pvIds }, supplierInvoiceId: { not: null } }, select: { id: true, pvNumber: true, payeeName: true, amount: true } });
        const pvOf = new Map(pvs.map((v) => [v.id, v]));
        const rows = today.filter((r) => pvOf.has(r.paymentVoucherId!));
        if (rows.length === 0) return;
        // the voucher's state after each payment: the running total of its payments up to that one
        const before = await prisma.hoPaymentInstallment.groupBy({ by: ['paymentVoucherId'], where: { recordedAt: { lt: start }, paymentVoucherId: { in: pvIds } }, _sum: { amount: true } });
        const running = new Map(before.map((b) => [b.paymentVoucherId!, num(b._sum.amount)]));
        const payments: HoDayPayment[] = rows.map((r) => {
            const v = pvOf.get(r.paymentVoucherId!)!;
            const paid = r2((running.get(v.id) ?? 0) + num(r.amount));
            running.set(v.id, paid);
            const total = num(v.amount);
            return { pvNumber: v.pvNumber, vendor: v.payeeName, amount: num(r.amount), reference: r.reference, voucherPaid: vendorPaymentState(total, paid) === 'COMPLETED', remaining: r2(total - paid) };
        });
        const { title, message } = hoPaymentDigest(payments);
        const common = { title, message, type: 'FINANCE' as const, priority: 'MEDIUM' as const, link: '/procurement/vendor-payments', metadata: { day, payments: payments.length }, dedupKey: hoPaymentDigestKey(day), reopen: true };
        await NotificationService.notifyByAudience({ audience: 'OSP_VENDOR_PAYMENTS', ...common });
        await NotificationService.notifyByAudience({ audience: 'FINANCE_ALL', ...common });
    }

    /**
     * Vendor Payment Status: every OSP vendor voucher that is with HO or paid by HO, with what HO paid, what is still to pay, and each payment
     * the HO Account Executive recorded. Company-wide like the voucher chain (a vendor payment belongs to no area).
     */
    static async statusList() {
        const vouchers = await prisma.paymentVoucher.findMany({
            where: { supplierInvoiceId: { not: null }, OR: [{ status: 'SUBMITTED_TO_HO' }, { status: 'PAID', hoPaidAmount: { gt: 0 } }] },
            orderBy: { createdAt: 'desc' },
            take: 500,
            select: { id: true, pvNumber: true, status: true, amount: true, hoPaidAmount: true, payeeName: true, supplierInvoiceId: true, createdAt: true },
        });
        const ids = vouchers.map((v) => v.id);
        const [invoices, parts] = await Promise.all([
            prisma.supplierInvoice.findMany({ where: { id: { in: vouchers.map((v) => v.supplierInvoiceId!) } }, select: { id: true, invoiceNumber: true, status: true, vendor: { select: { name: true } }, storePo: { select: { poNumber: true } } } }),
            prisma.hoPaymentInstallment.findMany({ where: { paymentVoucherId: { in: ids } }, orderBy: { recordedAt: 'asc' }, select: { paymentVoucherId: true, amount: true, paidDate: true, reference: true, method: true, recordedById: true, recordedAt: true } }),
        ]);
        const people = await prisma.user.findMany({ where: { id: { in: [...new Set(parts.map((p) => p.recordedById))] } }, select: { id: true, name: true, username: true } });
        const who = new Map(people.map((p) => [p.id, p.name || p.username]));
        const inv = new Map(invoices.map((i) => [i.id, i]));
        const byVoucher = new Map<string, typeof parts>();
        for (const p of parts) byVoucher.set(p.paymentVoucherId!, [...(byVoucher.get(p.paymentVoucherId!) ?? []), p]);
        return vouchers.map((v) => {
            const i = inv.get(v.supplierInvoiceId!);
            const own = byVoucher.get(v.id) ?? [];
            const amount = num(v.amount);
            const paid = num(v.hoPaidAmount);
            const last = own[own.length - 1];
            return {
                id: v.id, pvNumber: v.pvNumber, vendor: i?.vendor.name ?? v.payeeName, invoiceNumber: i?.invoiceNumber ?? null, invoiceStatus: i?.status ?? null, poNumber: i?.storePo?.poNumber ?? null,
                amount, paid, remaining: r2(amount - paid), state: vendorPaymentState(amount, paid), sentToHoAt: v.createdAt,
                lastPaidDate: last?.paidDate ?? null, lastReference: last?.reference ?? null,
                payments: own.map((p) => ({ amount: num(p.amount), paidDate: p.paidDate, reference: p.reference, method: p.method, recordedBy: who.get(p.recordedById) ?? null, recordedAt: p.recordedAt })),
            };
        });
    }

    /** The voucher's payments: what it is for, paid so far, still to pay, and each HO payment. */
    static async listForVoucher(voucherId: string) {
        const pv = await prisma.paymentVoucher.findUnique({ where: { id: voucherId }, select: { id: true, pvNumber: true, amount: true, hoPaidAmount: true, status: true } });
        if (!pv) throw AppError.notFound('Payment voucher not found');
        const rows = await prisma.hoPaymentInstallment.findMany({ where: { paymentVoucherId: voucherId }, orderBy: { recordedAt: 'asc' } });
        const ids = [...new Set(rows.map((r) => r.recordedById))];
        const people = ids.length ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, username: true } }) : [];
        const who = new Map(people.map((p) => [p.id, p.name || p.username]));
        return {
            voucher: { id: pv.id, pvNumber: pv.pvNumber, status: pv.status, amount: num(pv.amount), paid: num(pv.hoPaidAmount), remaining: r2(num(pv.amount) - num(pv.hoPaidAmount)) },
            payments: rows.map((r) => ({ id: r.id, amount: num(r.amount), paidDate: r.paidDate, reference: r.reference, method: r.method, remarks: r.remarks, recordedBy: who.get(r.recordedById) ?? null })),
        };
    }
}
