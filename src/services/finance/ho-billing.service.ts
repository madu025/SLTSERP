import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';
import { AuditService } from '@/services/audit/audit.service';
import { AuditLedgerService } from '@/services/inventory/audit-ledger.service';
import { NotificationService } from '@/services/notification';
import { NotificationTemplateEngineService } from '@/services/notification/template-engine.service';
import { EmailService } from '@/services/notification/email.service';
import { LedgerService } from '@/services/finance/ledger.service';
import { ACCOUNTS } from '@/services/finance/account-codes';
import type { TransactionClient } from '@/types/inventory/inventory-service.types';
import { assertProjectAccess } from '@/lib/project-access';
import { resolveOpmcScope } from '@/lib/opmc-scope';
import { billingBatchStatus, collectionStatusAfter, projectNetWithHo, sendBlocker, senderCannotConfirm, validCollectionAmount } from '@/lib/ho-billing-rules';

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ESCAPES[c] ?? c);
const day = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : '');
const num = (v: unknown) => Number(v ?? 0);
const round2 = (n: number) => Math.round(n * 100) / 100;

export interface BillingPackLine {
    invoiceId: string; invoiceNumber: string; project: string | null; title: string; periodFrom: string; periodTo: string;
    invoiceDate: string; dueDate: string; submissionReference: string | null; submittedToSltOn: string;
    subtotal: number; vat: number; sscl: number; withholding: number; total: number; collected: number; balance: number;
    status: string; sentBy: string | null;
}

/**
 * OSP has no bank. The OSP Finance Section sends client invoices that were submitted to SLT to Head Office as a numbered
 * pack (the record), and Head Office is responsible for collecting the money from SLT. Head Office confirms each
 * collection with its own reference; only then is the receivable cleared, against the Head Office current account (HO-2020).
 */
export class HoBillingService {
    private static async scopeWhere(userId: string): Promise<Prisma.ProjectInvoiceWhereInput> {
        const scope = await resolveOpmcScope(userId, 'finance');
        return scope === undefined ? {} : { project: { opmcId: { in: scope } } };
    }

    /** Client invoices already submitted to SLT with a balance, not currently with Head Office. */
    static async readyToSend(userId: string) {
        const rows = await prisma.projectInvoice.findMany({
            where: { type: 'CLIENT', submissionStatus: 'SUBMITTED_TO_SLT', balanceAmount: { gt: 0 }, hoCollectionStatus: { in: ['NOT_SENT', 'RETURNED'] }, ...(await this.scopeWhere(userId)) },
            orderBy: { submittedAt: 'asc' }, take: 300,
            select: { id: true, invoiceNumber: true, title: true, totalAmount: true, balanceAmount: true, dueDate: true, submittedAt: true, submissionReference: true, createdById: true, hoCollectionStatus: true, hoReturnReason: true, project: { select: { name: true } } },
        });
        return rows.map((r) => ({ ...r, totalAmount: num(r.totalAmount), balanceAmount: num(r.balanceAmount), project: r.project?.name ?? null }));
    }

    static async create(userId: string, invoiceIds: string[], note?: string | null) {
        const ids = [...new Set(invoiceIds)];
        if (ids.length === 0) throw AppError.badRequest('Choose at least one invoice');
        const invoices = await prisma.projectInvoice.findMany({ where: { id: { in: ids } } });
        if (invoices.length !== ids.length) throw AppError.badRequest('INVOICE_NOT_FOUND');
        for (const i of invoices) {
            const blocker = sendBlocker({ type: i.type, status: i.status, submissionStatus: i.submissionStatus, balanceAmount: num(i.balanceAmount), hoCollectionStatus: i.hoCollectionStatus, hoBillingBatchId: i.hoBillingBatchId });
            if (blocker) throw AppError.badRequest(`${blocker}: ${i.invoiceNumber}`);
            await assertProjectAccess(i.projectId, userId);
        }
        const total = round2(invoices.reduce((a, i) => a + num(i.balanceAmount), 0));
        const batch = await prisma.$transaction(async (tx) => {
            const batchNumber = await AuditLedgerService.getNextDocumentNumber('HBP', tx);
            const b = await tx.hoBillingBatch.create({ data: { batchNumber, status: 'SENT', totalAmount: total, invoiceCount: invoices.length, note: note ?? null, createdById: userId } });
            const moved = await tx.projectInvoice.updateMany({
                where: { id: { in: ids }, hoCollectionStatus: { in: ['NOT_SENT', 'RETURNED'] } },
                data: { hoCollectionStatus: 'SENT_TO_HO', hoBillingBatchId: b.id, sentToHoAt: new Date(), sentToHoById: userId, hoReturnReason: null },
            });
            if (moved.count !== ids.length) throw AppError.conflict('An invoice changed while the pack was being made; refresh and try again');
            return b;
        });
        AuditService.log({ userId, action: 'SEND_HO_BILLING_PACK', entity: 'HO_BILLING_BATCH', entityId: batch.id, newValue: { batch: batch.batchNumber, invoices: invoices.map((i) => i.invoiceNumber), total } }).catch(() => undefined);
        await this.notify(batch.batchNumber, invoices.length, total, batch.id).catch(() => undefined);
        return batch;
    }

    private static async notify(batchNumber: string, count: number, total: number, id: string) {
        await NotificationService.notifyByAudience({
            audience: 'FINANCE_APPROVERS',
            title: `Billing pack ${batchNumber} sent to Head Office`,
            message: `${count} client invoice(s), balance ${total.toLocaleString('en-US')}. Head Office collects from SLT and confirms each collection.`,
            type: 'SYSTEM', priority: 'MEDIUM', link: '/finance/ho-billing', metadata: { source: 'ho-billing', batchId: id }, dedupKey: `ho-billing:${id}`,
        });
        const to = process.env.HO_FINANCE_EMAIL;
        if (!to) return;
        const vars = { batchNumber, invoiceCount: String(count), totalAmount: total.toLocaleString('en-US'), submittedOn: day(new Date()), link: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/finance/ho-billing` };
        const rendered = await NotificationTemplateEngineService.renderEmailByCode('HO_BILLING_PACK_SUBMITTED', vars);
        const subject = rendered?.subject ?? `Billing pack ${batchNumber} sent for collection`;
        const html = rendered?.html ?? `<html><body style="font-family:Arial,sans-serif;padding:20px;color:#1e293b;"><h2>Billing pack ${esc(batchNumber)}</h2><p>${count} client invoice(s) with a balance of ${esc(vars.totalAmount)} were sent by the OSP Finance Section for collection from SLT.</p><p>Please confirm each collection with your reference in the ERP.</p></body></html>`;
        const text = rendered?.text ?? `Billing pack ${batchNumber}: ${count} invoice(s), balance ${vars.totalAmount}, sent ${vars.submittedOn}.`;
        await EmailService.sendMail({ to, subject, text, html });
    }

    /** Packs with their invoices (only the invoices inside the caller's scope). */
    static async list(userId: string) {
        const where = await this.scopeWhere(userId);
        const invoices = await prisma.projectInvoice.findMany({
            where: { hoBillingBatchId: { not: null }, ...where },
            orderBy: { sentToHoAt: 'desc' }, take: 500,
            select: { id: true, invoiceNumber: true, title: true, hoBillingBatchId: true, hoCollectionStatus: true, totalAmount: true, paidAmount: true, balanceAmount: true, submissionReference: true, sentToHoAt: true, sentToHoById: true, project: { select: { name: true } } },
        });
        const batchIds = [...new Set(invoices.map((i) => i.hoBillingBatchId!).filter(Boolean))];
        const batches = await prisma.hoBillingBatch.findMany({ where: { id: { in: batchIds } }, orderBy: { submittedAt: 'desc' } });
        return batches.map((b) => {
            const inv = invoices.filter((i) => i.hoBillingBatchId === b.id);
            return {
                id: b.id, batchNumber: b.batchNumber, submittedAt: b.submittedAt, note: b.note, totalAmount: num(b.totalAmount), invoiceCount: b.invoiceCount,
                status: billingBatchStatus(inv.map((i) => i.hoCollectionStatus)), collected: inv.filter((i) => i.hoCollectionStatus === 'COLLECTED').length,
                invoices: inv.map((i) => ({ id: i.id, invoiceNumber: i.invoiceNumber, title: i.title, project: i.project?.name ?? null, status: i.hoCollectionStatus, total: num(i.totalAmount), collected: num(i.paidAmount), balance: num(i.balanceAmount), submissionReference: i.submissionReference, sentById: i.sentToHoById })),
            };
        });
    }

    /** Everything Head Office needs to collect: the invoice, the project and period, the SLT submission reference, tax lines and balance. */
    static async pack(userId: string, batchId: string): Promise<{ batchNumber: string; submittedAt: string; lines: BillingPackLine[] }> {
        const batch = await prisma.hoBillingBatch.findUnique({ where: { id: batchId } });
        if (!batch) throw AppError.notFound('Billing pack not found');
        const invoices = await prisma.projectInvoice.findMany({ where: { hoBillingBatchId: batchId }, orderBy: { invoiceNumber: 'asc' }, include: { project: { select: { name: true } } } });
        const lines: BillingPackLine[] = [];
        for (const i of invoices) {
            await assertProjectAccess(i.projectId, userId);
            const sender = i.sentToHoById ? await prisma.user.findUnique({ where: { id: i.sentToHoById }, select: { name: true } }) : null;
            lines.push({
                invoiceId: i.id, invoiceNumber: i.invoiceNumber, project: i.project?.name ?? null, title: i.title, periodFrom: day(i.periodFrom), periodTo: day(i.periodTo),
                invoiceDate: day(i.invoiceDate), dueDate: day(i.dueDate), submissionReference: i.submissionReference, submittedToSltOn: day(i.submittedAt),
                subtotal: num(i.subtotal), vat: num(i.vatAmount), sscl: num(i.ssclAmount), withholding: num(i.whtAmount), total: num(i.totalAmount), collected: num(i.paidAmount), balance: num(i.balanceAmount),
                status: i.hoCollectionStatus, sentBy: sender?.name ?? null,
            });
        }
        return { batchNumber: batch.batchNumber, submittedAt: batch.submittedAt.toISOString(), lines };
    }

    private static async refreshBatch(tx: TransactionClient, batchId: string | null) {
        if (!batchId) return;
        const sts = (await tx.projectInvoice.findMany({ where: { hoBillingBatchId: batchId }, select: { hoCollectionStatus: true } })).map((r) => r.hoCollectionStatus);
        await tx.hoBillingBatch.update({ where: { id: batchId }, data: { status: billingBatchStatus(sts) } });
    }

    /** Head Office confirms it collected (all or part of) the invoice from SLT. Posts Dr Head Office account / Cr Accounts receivable. */
    static async confirmCollection(userId: string, input: { invoiceId: string; amount: number; hoReference: string; hoDate: Date; recordedOnBehalf?: boolean }) {
        const hoReference = input.hoReference.trim();
        if (!hoReference || Number.isNaN(input.hoDate.getTime())) throw AppError.badRequest('HO_REFERENCE_AND_DATE_REQUIRED');
        const receipt = await prisma.$transaction(async (tx) => {
            await tx.$queryRaw`SELECT "id" FROM "ProjectInvoice" WHERE "id" = ${input.invoiceId}::uuid FOR UPDATE`;
            const inv = await tx.projectInvoice.findUnique({ where: { id: input.invoiceId } });
            if (!inv) throw AppError.notFound('Invoice not found');
            if (!['SENT_TO_HO', 'PARTIALLY_COLLECTED'].includes(inv.hoCollectionStatus)) throw AppError.badRequest('ONLY_INVOICES_WITH_HEAD_OFFICE_CAN_BE_CONFIRMED_COLLECTED');
            if (senderCannotConfirm(inv.sentToHoById, userId)) throw AppError.badRequest('SENDER_CANNOT_CONFIRM_HEAD_OFFICE_COLLECTION');
            const balance = num(inv.balanceAmount);
            if (!validCollectionAmount(balance, input.amount)) throw AppError.badRequest('COLLECTION_AMOUNT_MUST_BE_POSITIVE_AND_NOT_ABOVE_THE_INVOICE_BALANCE');
            const dup = await tx.customerReceipt.findFirst({ where: { invoiceId: inv.id, referenceNumber: hoReference }, select: { id: true } });
            if (dup) throw AppError.conflict('A collection with this Head Office reference already exists for this invoice');

            const amount = new Prisma.Decimal(input.amount);
            const receiptNo = await AuditLedgerService.getNextDocumentNumber('RCT', tx);
            const created = await tx.customerReceipt.create({
                data: { receiptNumber: receiptNo, invoiceId: inv.id, amount, paymentMethod: 'HEAD_OFFICE', referenceNumber: hoReference, receiptDate: input.hoDate, notes: `Collected by Head Office${input.recordedOnBehalf ? ' (recorded on its behalf)' : ''}`, createdById: userId },
            });
            const newPaid = new Prisma.Decimal(inv.paidAmount).plus(amount);
            const newBalance = new Prisma.Decimal(inv.totalAmount).minus(newPaid);
            const settled = newBalance.lte(0);
            await tx.projectInvoice.update({
                where: { id: inv.id },
                data: {
                    paidAmount: newPaid, balanceAmount: newBalance, status: settled ? 'PAID' : 'PARTIALLY_PAID', paymentStatus: settled ? 'PAID' : 'PARTIALLY_PAID',
                    paymentReceivedAt: input.hoDate, paymentReference: hoReference, hoCollectionStatus: collectionStatusAfter(num(inv.totalAmount), newPaid.toNumber()),
                },
            });
            await LedgerService.postTransaction(tx, {
                referenceId: created.id, referenceType: 'CUSTOMER_RECEIPT', description: `Collected by Head Office: ${inv.invoiceNumber} (HO ref ${hoReference})`, date: input.hoDate, createdById: userId,
                lines: [
                    { accountCode: ACCOUNTS.HO_CURRENT, debit: input.amount, credit: 0, description: `Head Office collected ${inv.invoiceNumber} from SLT` },
                    { accountCode: ACCOUNTS.AR_CLIENT, debit: 0, credit: input.amount, description: `Receivable cleared ${inv.invoiceNumber}` },
                ],
            });
            await this.refreshBatch(tx, inv.hoBillingBatchId);
            return { id: created.id, receiptNumber: receiptNo, invoiceNumber: inv.invoiceNumber, status: settled ? 'COLLECTED' : 'PARTIALLY_COLLECTED' };
        });
        AuditService.log({ userId, action: 'HO_CONFIRM_COLLECTION', entity: 'PROJECT_INVOICE', entityId: input.invoiceId, newValue: { amount: input.amount, hoReference, hoDate: day(input.hoDate), recordedOnBehalf: !!input.recordedOnBehalf } }).catch(() => undefined);
        return receipt;
    }

    /** Head Office sends an invoice back (not yet collected) with a reason; it returns to OSP Finance. */
    static async returnInvoice(userId: string, invoiceId: string, reason: string) {
        const why = reason.trim();
        if (!why) throw AppError.badRequest('RETURN_REASON_REQUIRED');
        const inv = await prisma.projectInvoice.findUnique({ where: { id: invoiceId }, select: { id: true, invoiceNumber: true, hoCollectionStatus: true, hoBillingBatchId: true, sentToHoById: true } });
        if (!inv) throw AppError.notFound('Invoice not found');
        if (inv.hoCollectionStatus !== 'SENT_TO_HO') throw AppError.badRequest('ONLY_INVOICES_WITH_NOTHING_COLLECTED_CAN_BE_RETURNED');
        if (senderCannotConfirm(inv.sentToHoById, userId)) throw AppError.badRequest('SENDER_CANNOT_CONFIRM_HEAD_OFFICE_COLLECTION');
        await prisma.$transaction(async (tx) => {
            const r = await tx.projectInvoice.updateMany({ where: { id: invoiceId, hoCollectionStatus: 'SENT_TO_HO' }, data: { hoCollectionStatus: 'RETURNED', hoReturnReason: why } });
            if (r.count !== 1) throw AppError.conflict('The invoice changed; refresh and try again');
            await this.refreshBatch(tx, inv.hoBillingBatchId);
            await tx.projectInvoice.update({ where: { id: invoiceId }, data: { hoBillingBatchId: null } });
        });
        AuditService.log({ userId, action: 'HO_RETURN_BILLING', entity: 'PROJECT_INVOICE', entityId: invoiceId, newValue: { reason: why } }).catch(() => undefined);
        return { id: invoiceId, status: 'RETURNED' };
    }

    /** Per project: billed to SLT, with Head Office, collected by Head Office; contractor/vendor payments requested and paid by Head Office; net. */
    static async position(userId: string) {
        const where = await this.scopeWhere(userId);
        const invoices = await prisma.projectInvoice.findMany({
            where: { type: 'CLIENT', submissionStatus: 'SUBMITTED_TO_SLT', ...where },
            select: { id: true, projectId: true, totalAmount: true, paidAmount: true, balanceAmount: true, hoCollectionStatus: true, project: { select: { name: true, projectCode: true } } },
        });
        const projectIds = [...new Set(invoices.map((i) => i.projectId))];
        const hoReceipts = await prisma.customerReceipt.findMany({ where: { paymentMethod: 'HEAD_OFFICE', invoice: { projectId: { in: projectIds } } }, select: { amount: true, invoice: { select: { projectId: true } } } });
        const vouchers = await prisma.paymentVoucher.findMany({
            where: { projectId: { in: projectIds }, status: { in: ['APPROVED', 'SUBMITTED_TO_HO', 'PAID'] } },
            select: { projectId: true, status: true, netAmount: true },
        });
        const rows = projectIds.map((pid) => {
            const inv = invoices.filter((i) => i.projectId === pid);
            const billed = round2(inv.reduce((a, i) => a + num(i.totalAmount), 0));
            const sentToHo = round2(inv.filter((i) => i.hoCollectionStatus !== 'NOT_SENT' && i.hoCollectionStatus !== 'RETURNED').reduce((a, i) => a + num(i.totalAmount), 0));
            const collected = round2(hoReceipts.filter((r) => r.invoice?.projectId === pid).reduce((a, r) => a + num(r.amount), 0));
            const vs = vouchers.filter((v) => v.projectId === pid);
            const sum = (st: string[]) => round2(vs.filter((v) => st.includes(v.status)).reduce((a, v) => a + num(v.netAmount), 0));
            const voucherRequested = sum(['APPROVED', 'SUBMITTED_TO_HO', 'PAID']);
            const voucherWithHo = sum(['SUBMITTED_TO_HO']);
            const voucherPaid = sum(['PAID']);
            return {
                projectId: pid, project: inv[0]?.project?.name ?? '', code: inv[0]?.project?.projectCode ?? null,
                billed, sentToHo, collected, outstandingAtSlt: round2(inv.reduce((a, i) => a + num(i.balanceAmount), 0)),
                voucherRequested, voucherWithHo, voucherPaid, netWithHo: projectNetWithHo({ collected, voucherPaid }),
            };
        });
        return rows.sort((a, b) => b.billed - a.billed);
    }
}
