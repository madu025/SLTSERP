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

export const PV_STAGES = ['ACCOUNT_MANAGER', 'OSP_MANAGER', 'HEAD_OF_SECTION'] as const;
export type PvStage = (typeof PV_STAGES)[number];
export const PV_STAGE_LABEL: Record<PvStage, string> = { ACCOUNT_MANAGER: 'OSP Account Manager', OSP_MANAGER: 'OSP Manager', HEAD_OF_SECTION: 'Head of Section' };
const STAGE_PERMISSION: Record<PvStage, string> = {
    ACCOUNT_MANAGER: RBAC_PERMISSIONS.FINANCE_PV_APPROVE_ACCOUNT,
    OSP_MANAGER: RBAC_PERMISSIONS.FINANCE_PV_APPROVE_OSP,
    HEAD_OF_SECTION: RBAC_PERMISSIONS.FINANCE_PV_APPROVE_HOS,
};
export type PvChainAction = 'APPROVE' | 'REJECT' | 'DOCS_SENT' | 'DOCS_RECEIVED' | 'DOCS_NOT_RECEIVED';

type TrailEntry = { stage: string | null; action: string; userId: string; at: string; remarks: string | null };
const trailOf = (v: unknown): TrailEntry[] => (Array.isArray(v) ? (v as TrailEntry[]) : []);
const entry = (stage: string | null, action: string, userId: string, remarks?: string | null): TrailEntry => ({ stage, action, userId, at: new Date().toISOString(), remarks: remarks?.trim() || null });

/**
 * The company flow for a vendor payment voucher raised from a GRN invoice (owner's diagram):
 *   OSP Account Officer raises it -> OSP Account Manager -> OSP Manager -> Head of Section (the vendor invoice is posted here) ->
 *   the OSP Account (Officer or Manager) sends the documents to Procurement and confirms it -> Procurement Officer checks them (received: sent to HO;
 *   not received: back to the OSP Account with remarks, which sends them again) -> HO pays. Every step notifies the people of the next one.
 * A rejection at any step sends the voucher back to the Account Officer (DRAFT) with the remarks. Nobody signs two steps, and the maker signs none.
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

    /** Step 1, called from the voucher approval of the OSP Account Manager: moves the voucher on to the OSP Manager. */
    static async accountManagerStep(pvId: string, userId: string) {
        const pv = await prisma.paymentVoucher.findUniqueOrThrow({ where: { id: pvId } });
        if (!(await userHasPermission(userId, STAGE_PERMISSION.ACCOUNT_MANAGER))) throw AppError.forbidden('PV_STAGE_NOT_PERMITTED: this voucher waits for the OSP Account Manager');
        if (pv.approvalStage !== 'ACCOUNT_MANAGER') throw AppError.badRequest('This voucher is not waiting for the OSP Account Manager');
        const claim = await prisma.paymentVoucher.updateMany({
            where: { id: pvId, status: 'PENDING_APPROVAL', approvalStage: 'ACCOUNT_MANAGER' },
            data: { approvalStage: 'OSP_MANAGER', approvalTrail: [...trailOf(pv.approvalTrail), entry('ACCOUNT_MANAGER', 'APPROVED', userId)] as never },
        });
        if (claim.count === 0) throw AppError.conflict('This voucher was just actioned by someone else');
        AuditService.log({ userId, action: 'PV_CHAIN_APPROVE', entity: 'PAYMENT_VOUCHER', entityId: pvId, newValue: { stage: 'ACCOUNT_MANAGER', next: 'OSP_MANAGER' } }).catch(() => undefined);
        notifyStep('PROCESS_GATE_OSP_MANAGER', pv, 'Vendor payment to approve (OSP Manager)', 'accepted by the OSP Account Manager, waiting for your approval');
        return prisma.paymentVoucher.findUniqueOrThrow({ where: { id: pvId } });
    }

    static async act(pvId: string, userId: string, action: PvChainAction, remarks?: string | null, matchOverrideReason?: string | null) {
        const pv = await prisma.paymentVoucher.findUnique({ where: { id: pvId } });
        if (!pv) throw AppError.notFound('Payment voucher not found');
        await this.assertChainAccess(pv, userId);
        if (!(await this.isChainVoucher(pv.supplierInvoiceId))) throw AppError.badRequest('This voucher does not follow the vendor payment chain');
        const trail = trailOf(pv.approvalTrail);
        const note = remarks?.trim() || null;
        const can = (p: string) => userHasPermission(userId, p);

        if (action === 'APPROVE' || action === 'REJECT') {
            const stage = pv.approvalStage as PvStage | null;
            if (pv.status !== 'PENDING_APPROVAL' || !stage || stage === 'ACCOUNT_MANAGER') throw AppError.badRequest('This voucher is not waiting at the OSP Manager or Head of Section step');
            if (!(await can(STAGE_PERMISSION[stage]))) throw AppError.forbidden(`PV_STAGE_NOT_PERMITTED: this voucher waits for the ${PV_STAGE_LABEL[stage]}`);
            if (pv.createdById === userId || trail.some((t) => t.action === 'APPROVED' && t.userId === userId)) {
                throw AppError.badRequest('SEGREGATION_OF_DUTIES_VIOLATION: the maker or an earlier approver cannot sign this step');
            }
            if (action === 'REJECT') {
                if (!note || note.length < 3) throw AppError.badRequest('Remarks are required when a voucher is rejected');
                const claim = await prisma.paymentVoucher.updateMany({ where: { id: pvId, status: 'PENDING_APPROVAL', approvalStage: stage }, data: { status: 'DRAFT', approvalStage: null, approvalTrail: [...trail, entry(stage, 'REJECTED', userId, note)] as never, notes: `${pv.notes ? pv.notes + ' | ' : ''}Rejected by the ${PV_STAGE_LABEL[stage]}: ${note}` } });
                if (claim.count === 0) throw AppError.conflict('This voucher was just actioned by someone else');
                notifyStep('FINANCE_ALL', pv, 'Vendor payment rejected', `rejected by the ${PV_STAGE_LABEL[stage]}: ${note}. Correct it and send it again.`, '/finance/ho-payments');
                if (pv.createdById) NotificationService.send({ userId: pv.createdById, title: 'Your payment voucher was rejected', message: `${pv.pvNumber}: rejected by the ${PV_STAGE_LABEL[stage]}: ${note}`, type: 'FINANCE', priority: 'HIGH', link: '/finance/ho-payments', metadata: { voucherId: pv.id } }).catch(() => undefined);
            } else if (stage === 'OSP_MANAGER') {
                const claim = await prisma.paymentVoucher.updateMany({ where: { id: pvId, status: 'PENDING_APPROVAL', approvalStage: stage }, data: { approvalStage: 'HEAD_OF_SECTION', approvalTrail: [...trail, entry(stage, 'APPROVED', userId, note)] as never } });
                if (claim.count === 0) throw AppError.conflict('This voucher was just actioned by someone else');
                notifyStep('PROCESS_GATE_HEAD_OF_SECTION', pv, 'Vendor payment to approve (Head of Section)', 'approved by the OSP Manager, waiting for your approval');
                notifyStep('FINANCE_ALL', pv, 'Vendor payment approved by the OSP Manager', 'approved by the OSP Manager; it now waits for the Head of Section', '/finance/ho-payments');
            } else {
                // last approval: the vendor invoice is approved and posted (GR/IR -> vendor payable), then the voucher is approved
                const { SupplierInvoiceService } = await import('@/services/procurement/supplier-invoice.service');
                const si = await prisma.supplierInvoice.findUniqueOrThrow({ where: { id: pv.supplierInvoiceId! }, select: { id: true, status: true } });
                if (['MATCHED', 'VARIANCE'].includes(si.status)) await SupplierInvoiceService.approve(si.id, userId, matchOverrideReason ?? null, { viaVoucherChain: true });
                const after = await prisma.supplierInvoice.findUniqueOrThrow({ where: { id: si.id }, select: { status: true } });
                if (!['APPROVED', 'PARTIALLY_PAID', 'PAID'].includes(after.status)) throw AppError.badRequest(`SUPPLIER_INVOICE_NOT_YET_APPROVED: the vendor invoice is ${after.status}; it needs its remaining approval first`);
                const claim = await prisma.paymentVoucher.updateMany({ where: { id: pvId, status: 'PENDING_APPROVAL', approvalStage: stage }, data: { status: 'APPROVED', approvalStage: null, approvedById: userId, approvedAt: new Date(), docsStatus: 'TO_SEND', approvalTrail: [...trail, entry(stage, 'APPROVED', userId, note)] as never } });
                if (claim.count === 0) throw AppError.conflict('This voucher was just actioned by someone else');
                notifyStep('FINANCE_ALL', pv, 'Vendor payment approved: send the documents to Procurement', 'approved by the Head of Section. Send the documents to the Procurement Officer and confirm it with "Documents sent".');
            }
            AuditService.log({ userId, action: `PV_CHAIN_${action}`, entity: 'PAYMENT_VOUCHER', entityId: pvId, newValue: { stage, remarks: note } }).catch(() => undefined);
            return prisma.paymentVoucher.findUniqueOrThrow({ where: { id: pvId } });
        }

        if (action === 'DOCS_SENT') {
            // the OSP Account Officer or Manager has sent the documents to Procurement (after the approval, or again after "not received")
            if (!(await can(RBAC_PERMISSIONS.FINANCE_WRITE))) throw AppError.forbidden('Sending the voucher documents to Procurement is the OSP Account\'s step');
            const claim = await prisma.paymentVoucher.updateMany({ where: { id: pvId, status: 'APPROVED', docsStatus: { in: ['TO_SEND', 'NOT_RECEIVED'] } }, data: { docsStatus: 'SENT', approvalTrail: [...trail, entry(null, 'DOCS_SENT', userId, note)] as never } });
            if (claim.count === 0) throw AppError.badRequest('Only an approved voucher whose documents are still to send can be marked sent');
            AuditService.log({ userId, action: 'PV_CHAIN_DOCS_SENT', entity: 'PAYMENT_VOUCHER', entityId: pvId, newValue: { remarks: note } }).catch(() => undefined);
            notifyStep('PROCESS_GATE_PROCUREMENT', pv, 'Voucher documents sent to Procurement', 'the OSP Account sent the documents: check them and mark them received or not received');
            return prisma.paymentVoucher.findUniqueOrThrow({ where: { id: pvId } });
        }

        // DOCS_RECEIVED / DOCS_NOT_RECEIVED: the Procurement Officer checks what the OSP Account sent
        if (!(await can(RBAC_PERMISSIONS.PROCUREMENT_PV_DOCUMENTS))) throw AppError.forbidden('Checking the voucher documents is the Procurement Officer\'s step');
        if (pv.status !== 'APPROVED' || pv.docsStatus !== 'SENT') throw AppError.badRequest('The OSP Account has not sent the documents of this voucher yet');
        if (pv.createdById === userId || trail.some((t) => t.action === 'APPROVED' && t.userId === userId)) throw AppError.badRequest('SEGREGATION_OF_DUTIES_VIOLATION: the maker or an approver cannot check the documents');
        if (action === 'DOCS_NOT_RECEIVED') {
            if (!note || note.length < 3) throw AppError.badRequest('Say which documents are missing');
            const claim = await prisma.paymentVoucher.updateMany({ where: { id: pvId, status: 'APPROVED', docsStatus: 'SENT' }, data: { docsStatus: 'NOT_RECEIVED', docsCheckedById: userId, docsCheckedAt: new Date(), docsRemarks: note, approvalTrail: [...trail, entry(null, 'DOCS_NOT_RECEIVED', userId, note)] as never } });
            if (claim.count === 0) throw AppError.conflict('This voucher was just actioned by someone else');
            notifyStep('FINANCE_ALL', pv, 'Voucher documents not received by Procurement', `missing: ${note}. Send them again and confirm "Documents sent".`, '/finance/ho-payments');
        } else {
            // documents inspected and confirmed: the voucher goes to the HO Invoice Section
            const claim = await prisma.paymentVoucher.updateMany({ where: { id: pvId, status: 'APPROVED', docsStatus: 'SENT' }, data: { status: 'SUBMITTED_TO_HO', submittedToHoById: userId, submittedToHoAt: new Date(), docsStatus: 'RECEIVED', docsCheckedById: userId, docsCheckedAt: new Date(), docsRemarks: note, approvalTrail: [...trail, entry(null, 'DOCS_RECEIVED_SENT_TO_HO', userId, note)] as never } });
            if (claim.count === 0) throw AppError.conflict('This voucher was just actioned by someone else');
            notifyStep('FINANCE_ALL', pv, 'Vendor payment sent to HO', 'documents received by Procurement; the voucher is with the HO Invoice Section. The Account Executive records HO\'s payments.', '/finance/ho-payments');
        }
        AuditService.log({ userId, action: `PV_CHAIN_${action}`, entity: 'PAYMENT_VOUCHER', entityId: pvId, newValue: { remarks: note } }).catch(() => undefined);
        return prisma.paymentVoucher.findUniqueOrThrow({ where: { id: pvId } });
    }

    /** The company-flow vouchers in the caller's scope, with where each one waits and its trail. */
    static async list(userId: string) {
        const rows = await prisma.paymentVoucher.findMany({
            where: { supplierInvoiceId: { not: null }, OR: [{ approvalStage: { not: null } }, { docsStatus: { not: null } }, { status: 'DRAFT', notes: { contains: 'Rejected by the' } }] },
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
            const stage = v.approvalStage as PvStage | null;
            return {
                id: v.id, pvNumber: v.pvNumber, status: v.status, amount: Number(v.amount), payee: v.payeeName,
                waitingFor: v.status === 'PENDING_APPROVAL' && stage ? PV_STAGE_LABEL[stage] : v.status === 'APPROVED' && v.docsStatus === 'TO_SEND' ? 'OSP Account (send the documents to Procurement)' : v.status === 'APPROVED' && v.docsStatus === 'SENT' ? 'Procurement Officer (check the documents)' : v.status === 'APPROVED' && v.docsStatus === 'NOT_RECEIVED' ? 'OSP Account (send the documents again)' : v.status === 'DRAFT' ? 'OSP Account Officer (rejected)' : v.status === 'SUBMITTED_TO_HO' ? 'HO (payment)' : '-',
                stage, docsStatus: v.docsStatus, docsRemarks: v.docsRemarks,
                invoiceNumber: i?.invoiceNumber ?? null, match: i?.matchStatus ?? null, poNumber: i?.storePo?.poNumber ?? null, vendor: i?.vendor.name ?? v.payeeName,
                grnNumber: g?.grnNumber ?? null, oracleGrnNumber: g?.oracleGrnNumber ?? null,
                trail: trailOf(v.approvalTrail).map((t) => ({ ...t, by: who.get(t.userId) ?? null })),
            };
        });
    }
}
