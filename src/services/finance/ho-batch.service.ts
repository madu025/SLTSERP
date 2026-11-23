import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';
import { AuditService } from '@/services/audit/audit.service';
import { AuditLedgerService } from '@/services/inventory/audit-ledger.service';
import { NotificationService } from '@/services/notification';
import { NotificationTemplateEngineService } from '@/services/notification/template-engine.service';
import { EmailService } from '@/services/notification/email.service';
import { assertVoucherAccess } from '@/lib/payment-voucher-access';
import { resolveOpmcScope } from '@/lib/opmc-scope';
import { batchStatus } from '@/lib/ho-payment-rules';
import { categoryOfSupplierInvoice } from '@/config/payment-categories';

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ESCAPES[c] ?? c);
const day = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : '');

export interface PackLine {
    voucherId: string; pvNumber: string; payee: string; type: string; amount: number; taxWithheld: number; retention: number; net: number;
    status: string; hoReference: string | null; hoPaidDate: string | null;
    category: string; invoiceNumber: string | null; invoiceDate: string | null; matchStatus: string | null; dueDate: string | null;
    poNumber: string | null; grnNumbers: string[]; approvedBy: string | null; approvedAt: string | null; project: string | null;
}

/**
 * The OSP Finance Section hands approved payment vouchers to Head Office as one numbered pack with the evidence Head Office
 * needs to pay (the invoice, its order and receipts, the match result and who approved). Head Office pays and confirms each
 * voucher with its own reference; nothing is paid or posted to the payable until that confirmation.
 */
export class HoBatchService {
    /** Vouchers that are approved and not yet in a pack, within the caller's access. */
    static async readyToSubmit(userId: string) {
        const scope = await resolveOpmcScope(userId, 'finance');
        return prisma.paymentVoucher.findMany({
            where: { status: 'APPROVED', hoBatchId: null, ...(scope === undefined ? {} : { project: { opmcId: { in: scope } } }) },
            orderBy: { approvedAt: 'asc' }, take: 300,
            select: { id: true, pvNumber: true, payeeName: true, type: true, amount: true, netAmount: true, approvedAt: true, approvedById: true, project: { select: { name: true } } },
        });
    }

    static async create(userId: string, voucherIds: string[], note?: string | null) {
        const ids = [...new Set(voucherIds)];
        if (ids.length === 0) throw AppError.badRequest('Choose at least one approved voucher');
        const vouchers = await prisma.paymentVoucher.findMany({ where: { id: { in: ids } } });
        if (vouchers.length !== ids.length) throw AppError.badRequest('VOUCHER_NOT_FOUND');
        for (const v of vouchers) {
            if (v.status !== 'APPROVED' || v.hoBatchId) throw AppError.badRequest(`VOUCHER_NOT_READY: ${v.pvNumber} is not an approved voucher waiting for submission`);
            if (v.approvedById && v.approvedById === userId) throw AppError.badRequest(`APPROVER_CANNOT_SUBMIT_THE_VOUCHER_THEY_APPROVED: ${v.pvNumber}`);
            await assertVoucherAccess(v.projectId, userId);
        }
        const total = Math.round(vouchers.reduce((a, v) => a + Number(v.netAmount), 0) * 100) / 100;
        const batch = await prisma.$transaction(async (tx) => {
            const batchNumber = await AuditLedgerService.getNextDocumentNumber('HOB', tx);
            const b = await tx.hoPaymentBatch.create({ data: { batchNumber, status: 'SUBMITTED', totalAmount: total, voucherCount: vouchers.length, note: note ?? null, createdById: userId } });
            const moved = await tx.paymentVoucher.updateMany({
                where: { id: { in: ids }, status: 'APPROVED', hoBatchId: null },
                data: { status: 'SUBMITTED_TO_HO', hoBatchId: b.id, submittedToHoAt: new Date(), submittedToHoById: userId },
            });
            if (moved.count !== ids.length) throw AppError.conflict('A voucher changed while the pack was being made; refresh and try again');
            return b;
        });
        AuditService.log({ userId, action: 'SUBMIT_HO_BATCH', entity: 'HO_PAYMENT_BATCH', entityId: batch.id, newValue: { batch: batch.batchNumber, vouchers: vouchers.map((v) => v.pvNumber), total } }).catch(() => undefined);
        await this.notify(batch.batchNumber, vouchers.length, total, batch.id).catch(() => undefined);
        return batch;
    }

    private static async notify(batchNumber: string, count: number, total: number, id: string) {
        await NotificationService.notifyByAudience({
            audience: 'FINANCE_APPROVERS',
            title: `Payment pack ${batchNumber} submitted to Head Office`,
            message: `${count} voucher(s), net ${total.toLocaleString('en-US')}. Head Office confirms each payment with its reference.`,
            type: 'SYSTEM', priority: 'MEDIUM', link: '/finance/ho-payments', metadata: { source: 'ho-batch', batchId: id }, dedupKey: `ho-batch:${id}`,
        });
        const to = process.env.HO_FINANCE_EMAIL;
        if (!to) return;
        const vars = { batchNumber, voucherCount: String(count), totalAmount: total.toLocaleString('en-US'), submittedOn: day(new Date()), link: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/finance/ho-payments` };
        const rendered = await NotificationTemplateEngineService.renderEmailByCode('HO_PAYMENT_BATCH_SUBMITTED', vars);
        const subject = rendered?.subject ?? `Payment pack ${batchNumber} submitted for payment`;
        const html = rendered?.html ?? `<html><body style="font-family:Arial,sans-serif;padding:20px;color:#1e293b;"><h2>Payment pack ${esc(batchNumber)}</h2><p>${count} voucher(s) with a net amount of ${esc(vars.totalAmount)} were submitted by the OSP Finance Section for payment.</p><p>Please confirm each payment with your reference in the ERP.</p></body></html>`;
        const text = rendered?.text ?? `Payment pack ${batchNumber}: ${count} voucher(s), net ${vars.totalAmount}, submitted ${vars.submittedOn}.`;
        await EmailService.sendMail({ to, subject, text, html });
    }

    static async list(userId: string, status?: string) {
        const scope = await resolveOpmcScope(userId, 'finance');
        const batches = await prisma.hoPaymentBatch.findMany({ orderBy: { submittedAt: 'desc' }, take: 100 });
        const vouchers = await prisma.paymentVoucher.findMany({
            where: { hoBatchId: { in: batches.map((b) => b.id) } },
            select: { id: true, hoBatchId: true, status: true, netAmount: true, pvNumber: true, payeeName: true, hoReference: true, hoPaidDate: true, projectId: true, project: { select: { opmcId: true } } },
        });
        const rows = batches.map((b) => {
            const vs = vouchers.filter((v) => v.hoBatchId === b.id);
            const visible = scope === undefined ? vs : vs.filter((v) => !v.projectId || (v.project?.opmcId && scope.includes(v.project.opmcId)));
            return {
                id: b.id, batchNumber: b.batchNumber, submittedAt: b.submittedAt, note: b.note, totalAmount: Number(b.totalAmount), voucherCount: b.voucherCount,
                status: batchStatus(vs.map((v) => v.status)), paid: vs.filter((v) => v.status === 'PAID').length,
                vouchers: visible.map((v) => ({ id: v.id, pvNumber: v.pvNumber, payee: v.payeeName, status: v.status, net: Number(v.netAmount), hoReference: v.hoReference, hoPaidDate: v.hoPaidDate })),
            };
        });
        return rows.filter((r) => r.vouchers.length > 0 || scope === undefined).filter((r) => !status || r.status === status);
    }

    /** Everything Head Office needs to pay: voucher, invoice, order, receipts, match result, approvals. */
    static async pack(userId: string, batchId: string): Promise<{ batchNumber: string; submittedAt: string; lines: PackLine[] }> {
        const batch = await prisma.hoPaymentBatch.findUnique({ where: { id: batchId } });
        if (!batch) throw AppError.notFound('Payment pack not found');
        const vs = await prisma.paymentVoucher.findMany({ where: { hoBatchId: batchId }, orderBy: { pvNumber: 'asc' }, include: { project: { select: { name: true } } } });
        const lines: PackLine[] = [];
        for (const v of vs) {
            await assertVoucherAccess(v.projectId, userId);
            const si = v.supplierInvoiceId ? await prisma.supplierInvoice.findUnique({ where: { id: v.supplierInvoiceId }, select: { invoiceNumber: true, invoiceDate: true, dueDate: true, matchStatus: true, storePoId: true, projectPoId: true, category: true } }) : null;
            let poNumber: string | null = null;
            const grns: string[] = [];
            if (si?.storePoId) {
                poNumber = (await prisma.purchaseOrder.findUnique({ where: { id: si.storePoId }, select: { poNumber: true } }))?.poNumber ?? null;
                grns.push(...(await prisma.gRN.findMany({ where: { purchaseOrderId: si.storePoId }, select: { grnNumber: true } })).map((g) => g.grnNumber));
            } else if (si?.projectPoId) {
                poNumber = (await prisma.projectPurchaseOrder.findUnique({ where: { id: si.projectPoId }, select: { poNumber: true } }))?.poNumber ?? null;
            }
            const approver = v.approvedById ? await prisma.user.findUnique({ where: { id: v.approvedById }, select: { name: true } }) : null;
            lines.push({
                voucherId: v.id, pvNumber: v.pvNumber, payee: v.payeeName, type: v.type, amount: Number(v.amount), taxWithheld: Number(v.taxWithheld), retention: Number(v.retentionAmount), net: Number(v.netAmount),
                status: v.status, hoReference: v.hoReference, hoPaidDate: v.hoPaidDate ? day(v.hoPaidDate) : null,
                category: si ? categoryOfSupplierInvoice(si.category) : (v.description ?? '').startsWith('BOM_INVOICING_REF:') ? 'SOD_CONTRACTOR' : 'PROJECT_CONTRACTOR',
                invoiceNumber: si?.invoiceNumber ?? null, invoiceDate: si ? day(si.invoiceDate) : null, matchStatus: si?.matchStatus ?? null, dueDate: si?.dueDate ? day(si.dueDate) : null,
                poNumber, grnNumbers: grns, approvedBy: approver?.name ?? null, approvedAt: v.approvedAt ? v.approvedAt.toISOString() : null, project: v.project?.name ?? null,
            });
        }
        return { batchNumber: batch.batchNumber, submittedAt: batch.submittedAt.toISOString(), lines };
    }
}
