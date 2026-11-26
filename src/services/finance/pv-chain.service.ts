import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';
import { userHasPermission } from '@/lib/user-permissions';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { AuditService } from '@/services/audit/audit.service';
import { assertVoucherAccess } from '@/lib/payment-voucher-access';
import { NotificationService } from '@/services/notification';
import type { NotificationAudienceId } from '@/services/notification/notification-audiences';

/** Tells the people of the next step (by notification audience, which the administrator controls) that a voucher waits for them. */
export function notifyStep(audience: NotificationAudienceId, pv: { id: string; pvNumber: string; payeeName: string; amount: unknown }, title: string, what: string, link = '/procurement/payment-approvals') {
    NotificationService.notifyByAudience({
        audience, title, type: 'FINANCE', priority: 'HIGH', link,
        message: `${pv.pvNumber} (${pv.payeeName}, ${Number(pv.amount).toLocaleString('en-US')}): ${what}`,
        metadata: { voucherId: pv.id, step: title }, dedupKey: `pv-chain:${pv.id}:${title}`,
    }).catch(() => undefined);
}

export type PvChainAction = 'SIGNED' | 'NOT_SIGNED' | 'DOCS_SENT' | 'DOCS_RECEIVED' | 'DOCS_NOT_RECEIVED';

type TrailEntry = { stage: string | null; action: string; userId: string; at: string; remarks: string | null };
const trailOf = (v: unknown): TrailEntry[] => (Array.isArray(v) ? (v as TrailEntry[]) : []);
const entry = (stage: string | null, action: string, userId: string, remarks?: string | null): TrailEntry => ({ stage, action, userId, at: new Date().toISOString(), remarks: remarks?.trim() || null });

/**
 * The company flow for a vendor payment voucher raised from a GRN invoice (owner, 26 Nov 2026):
 *   OSP Account Officer raises and submits it -> the OSP Account Manager, OSP Manager and Head of Section sign it on paper, and the Account Officer
 *   records "signed by all three" with the scan of the signed voucher (the vendor invoice is posted here) -> the Account Officer sends the documents
 *   and confirms it -> the HO Account Executive (HO Invoice Section) marks them received (the voucher is with HO) or not received (back to the
 *   Account Officer with remarks) -> the Account Executive records HO's payments. "Not signed" sends the voucher back to draft with the remarks.
 */
export class PvChainService {
    /** Is this voucher in the company chain (it pays the vendor invoice of one GRN)? */
    static async isChainVoucher(supplierInvoiceId: string | null | undefined): Promise<boolean> {
        if (!supplierInvoiceId) return false;
        const si = await prisma.supplierInvoice.findUnique({ where: { id: supplierInvoiceId }, select: { grnId: true } });
        return !!si?.grnId;
    }

    /**
     * Who may see and act on a company-flow voucher: the people of its chain (a vendor payment belongs to no area, so the area scope of
     * finance does not apply); anyone else needs the normal voucher access. The step itself is still checked by its own capability.
     */
    static async assertChainAccess(pv: { projectId: string | null; description: string | null }, userId: string) {
        if (await userHasPermission(userId, RBAC_PERMISSIONS.PROCUREMENT_PV_CHAIN_READ)) return;
        if (await userHasPermission(userId, RBAC_PERMISSIONS.PROCUREMENT_HO_PAYMENT_RECORD)) return;
        await assertVoucherAccess(pv.projectId, userId, pv.description);
    }

    static async act(pvId: string, userId: string, action: PvChainAction, remarks?: string | null, opts?: { signedVoucherUrl?: string | null }) {
        const pv = await prisma.paymentVoucher.findUnique({ where: { id: pvId } });
        if (!pv) throw AppError.notFound('Payment voucher not found');
        await this.assertChainAccess(pv, userId);
        if (!(await this.isChainVoucher(pv.supplierInvoiceId))) throw AppError.badRequest('This voucher does not follow the vendor payment chain');
        const trail = trailOf(pv.approvalTrail);
        const note = remarks?.trim() || null;
        const can = (p: string) => userHasPermission(userId, p);

        if (action === 'SIGNED' || action === 'NOT_SIGNED') {
            // the OSP Account records what happened on paper: the voucher was signed by the three, or it was not
            if (!(await can(RBAC_PERMISSIONS.FINANCE_WRITE))) throw AppError.forbidden('Recording the signatures of a voucher is the OSP Account\'s step');
            if (pv.status !== 'PENDING_APPROVAL' || pv.approvalStage !== 'SIGNATURES') throw AppError.badRequest('This voucher is not waiting for its signatures');
            if (action === 'NOT_SIGNED') {
                if (!note || note.length < 3) throw AppError.badRequest('Say why the voucher was not signed');
                const claim = await prisma.paymentVoucher.updateMany({ where: { id: pvId, status: 'PENDING_APPROVAL', approvalStage: 'SIGNATURES' }, data: { status: 'DRAFT', approvalStage: null, approvalTrail: [...trail, entry('SIGNATURES', 'NOT_SIGNED', userId, note)] as never, notes: `${pv.notes ? pv.notes + ' | ' : ''}Not signed: ${note}` } });
                if (claim.count === 0) throw AppError.conflict('This voucher was just actioned by someone else');
            } else {
                const url = (opts?.signedVoucherUrl ?? '').trim();
                // only a file stored by the upload service (never an outside or protocol-relative link)
                if (!/^\/api\/(storage|files)\/[^/]/.test(url)) throw AppError.badRequest('SIGNED_VOUCHER_SCAN_REQUIRED: attach the scan of the voucher signed by the Account Manager, OSP Manager and Head of Section');
                // the vendor invoice is approved and posted (GR/IR -> vendor payable) together with the signatures
                const { SupplierInvoiceService } = await import('@/services/procurement/supplier-invoice.service');
                const si = await prisma.supplierInvoice.findUniqueOrThrow({ where: { id: pv.supplierInvoiceId! }, select: { id: true, status: true } });
                // an invoice that does not match the PO and GRN is approved by a finance approver on Supplier Invoices (a different person,
                // with the reason), never by the voucher's maker here
                if (si.status === 'VARIANCE') throw AppError.badRequest('INVOICE_VARIANCE_NEEDS_FINANCE_APPROVAL: the vendor invoice does not match the PO and GRN; a finance approver approves it on Supplier Invoices first');
                if (si.status === 'MATCHED') await SupplierInvoiceService.approve(si.id, userId, null, { viaVoucherChain: true });
                const after = await prisma.supplierInvoice.findUniqueOrThrow({ where: { id: si.id }, select: { status: true } });
                if (!['APPROVED', 'PARTIALLY_PAID', 'PAID'].includes(after.status)) throw AppError.badRequest(`SUPPLIER_INVOICE_NOT_YET_APPROVED: the vendor invoice is ${after.status}`);
                const claim = await prisma.paymentVoucher.updateMany({ where: { id: pvId, status: 'PENDING_APPROVAL', approvalStage: 'SIGNATURES' }, data: { status: 'APPROVED', approvalStage: null, approvedById: userId, approvedAt: new Date(), docsStatus: 'TO_SEND', signedVoucherUrl: url, approvalTrail: [...trail, entry('SIGNATURES', 'SIGNED', userId, note ?? 'Signed by the OSP Account Manager, OSP Manager and Head of Section')] as never } });
                if (claim.count === 0) throw AppError.conflict('This voucher was just actioned by someone else');
            }
            AuditService.log({ userId, action: `PV_CHAIN_${action}`, entity: 'PAYMENT_VOUCHER', entityId: pvId, newValue: { remarks: note, signedVoucherUrl: opts?.signedVoucherUrl ?? null } }).catch(() => undefined);
            return prisma.paymentVoucher.findUniqueOrThrow({ where: { id: pvId } });
        }

        if (action === 'DOCS_SENT') {
            // the OSP Account has sent the documents to the HO Invoice Section (after the signatures, or again after "not received")
            if (!(await can(RBAC_PERMISSIONS.FINANCE_WRITE))) throw AppError.forbidden('Sending the voucher documents is the OSP Account\'s step');
            const claim = await prisma.paymentVoucher.updateMany({ where: { id: pvId, status: 'APPROVED', docsStatus: { in: ['TO_SEND', 'NOT_RECEIVED'] } }, data: { docsStatus: 'SENT', approvalTrail: [...trail, entry(null, 'DOCS_SENT', userId, note)] as never } });
            if (claim.count === 0) throw AppError.badRequest('Only a signed voucher whose documents are still to send can be marked sent');
            AuditService.log({ userId, action: 'PV_CHAIN_DOCS_SENT', entity: 'PAYMENT_VOUCHER', entityId: pvId, newValue: { remarks: note } }).catch(() => undefined);
            notifyStep('FINANCE_ALL', pv, 'Voucher documents sent to the HO Invoice Section', 'the OSP Account sent the signed voucher and its documents: the HO Account Executive marks them received or not received');
            return prisma.paymentVoucher.findUniqueOrThrow({ where: { id: pvId } });
        }

        // DOCS_RECEIVED / DOCS_NOT_RECEIVED: the HO Account Executive (HO Invoice Section) checks what the OSP Account sent
        if (!(await can(RBAC_PERMISSIONS.PROCUREMENT_HO_PAYMENT_RECORD))) throw AppError.forbidden('Checking the voucher documents is the HO Account Executive\'s step');
        if (pv.status !== 'APPROVED' || pv.docsStatus !== 'SENT') throw AppError.badRequest('The OSP Account has not sent the documents of this voucher yet');
        if (pv.createdById === userId) throw AppError.badRequest('SEGREGATION_OF_DUTIES_VIOLATION: the maker of the voucher cannot receive its documents');
        if (action === 'DOCS_NOT_RECEIVED') {
            if (!note || note.length < 3) throw AppError.badRequest('Say which documents are missing');
            const claim = await prisma.paymentVoucher.updateMany({ where: { id: pvId, status: 'APPROVED', docsStatus: 'SENT' }, data: { docsStatus: 'NOT_RECEIVED', docsCheckedById: userId, docsCheckedAt: new Date(), docsRemarks: note, approvalTrail: [...trail, entry(null, 'DOCS_NOT_RECEIVED', userId, note)] as never } });
            if (claim.count === 0) throw AppError.conflict('This voucher was just actioned by someone else');
            notifyStep('FINANCE_ALL', pv, 'Voucher documents not received at HO', `missing: ${note}. Send them again and confirm "Documents sent".`, '/procurement/payment-approvals');
        } else {
            // documents received: the voucher is with the HO Invoice Section; the Account Executive records HO's payments
            const claim = await prisma.paymentVoucher.updateMany({ where: { id: pvId, status: 'APPROVED', docsStatus: 'SENT' }, data: { status: 'SUBMITTED_TO_HO', submittedToHoById: userId, submittedToHoAt: new Date(), docsStatus: 'RECEIVED', docsCheckedById: userId, docsCheckedAt: new Date(), docsRemarks: note, approvalTrail: [...trail, entry(null, 'DOCS_RECEIVED_SENT_TO_HO', userId, note)] as never } });
            if (claim.count === 0) throw AppError.conflict('This voucher was just actioned by someone else');
            notifyStep('FINANCE_ALL', pv, 'Vendor payment with HO: record the payments', 'documents received by the HO Invoice Section. The Account Executive records HO\'s payments in full or in parts.', '/finance/ho-payments');
        }
        AuditService.log({ userId, action: `PV_CHAIN_${action}`, entity: 'PAYMENT_VOUCHER', entityId: pvId, newValue: { remarks: note } }).catch(() => undefined);
        return prisma.paymentVoucher.findUniqueOrThrow({ where: { id: pvId } });
    }

    /** The company-flow vouchers in the caller's scope, with where each one waits and its trail. */
    static async list(userId: string) {
        const rows = await prisma.paymentVoucher.findMany({
            where: { supplierInvoiceId: { not: null }, OR: [{ approvalStage: { not: null } }, { docsStatus: { not: null } }, { status: 'DRAFT', notes: { contains: 'Not signed:' } }] },
            orderBy: { createdAt: 'desc' },
            take: 300,
        });
        const visible = [];
        for (const r of rows) {
            try { await this.assertChainAccess(r, userId); visible.push(r); } catch { /* outside the caller's scope */ }
        }
        const invoices = await prisma.supplierInvoice.findMany({ where: { id: { in: visible.map((v) => v.supplierInvoiceId!) } }, select: { id: true, invoiceNumber: true, totalAmount: true, matchStatus: true, grnId: true, storePo: { select: { poNumber: true } }, vendor: { select: { name: true } } } });
        const grns = await prisma.gRN.findMany({ where: { id: { in: invoices.map((i) => i.grnId!).filter(Boolean) } }, select: { id: true, grnNumber: true, oracleGrnNumber: true } });
        const ids = [...new Set(visible.flatMap((v) => trailOf(v.approvalTrail).map((t) => t.userId)))];
        const people = ids.length ? await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, username: true } }) : [];
        const who = new Map(people.map((p) => [p.id, p.name || p.username]));
        const inv = new Map(invoices.map((i) => [i.id, i]));
        const grn = new Map(grns.map((g) => [g.id, g]));
        return visible.map((v) => {
            const i = inv.get(v.supplierInvoiceId!);
            const g = i?.grnId ? grn.get(i.grnId) : undefined;
                        return {
                id: v.id, pvNumber: v.pvNumber, status: v.status, amount: Number(v.amount), payee: v.payeeName,
                waitingFor: v.status === 'PENDING_APPROVAL' && v.approvalStage === 'SIGNATURES' ? 'OSP Account (signatures of the Account Manager, OSP Manager and Head of Section)' : v.status === 'APPROVED' && v.docsStatus === 'TO_SEND' ? 'OSP Account (send the documents to HO)' : v.status === 'APPROVED' && v.docsStatus === 'SENT' ? 'HO Account Executive (check the documents)' : v.status === 'APPROVED' && v.docsStatus === 'NOT_RECEIVED' ? 'OSP Account (send the documents again)' : v.status === 'DRAFT' ? 'OSP Account Officer (not signed)' : v.status === 'SUBMITTED_TO_HO' ? 'HO (payment)' : '-',
                stage: v.approvalStage, docsStatus: v.docsStatus, signedVoucherUrl: v.signedVoucherUrl, docsRemarks: v.docsRemarks,
                invoiceNumber: i?.invoiceNumber ?? null, match: i?.matchStatus ?? null, poNumber: i?.storePo?.poNumber ?? null, vendor: i?.vendor.name ?? v.payeeName,
                grnNumber: g?.grnNumber ?? null, oracleGrnNumber: g?.oracleGrnNumber ?? null,
                trail: trailOf(v.approvalTrail).map((t) => ({ ...t, by: who.get(t.userId) ?? null })),
            };
        });
    }
}
