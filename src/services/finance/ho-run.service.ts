import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';
import { PaymentVoucherService } from '@/services/finance/payment-voucher.service';
import { HoMonthlyService } from '@/services/finance/ho-monthly.service';
import { assertVoucherAccess, assertContractorAreaAccess, areaAllows, sodInvoiceIdOf } from '@/lib/payment-voucher-access';
import { assertProjectAccess } from '@/lib/project-access';
import { resolveOpmcScope } from '@/lib/opmc-scope';
import { categoryOfSupplierInvoice, requestBlocker, PAYMENT_CATEGORIES, type PaymentCategory } from '@/config/payment-categories';

export type RunKind = 'VENDOR' | 'CONTRACTOR' | 'SOD';
export interface RunItem { kind: RunKind; id: string; amount: number; taxWithheld?: number; retentionAmount?: number }
export interface RunResult { kind: RunKind; id: string; label: string; ok: boolean; voucherId?: string; pvNumber?: string; error?: string }

const num = (v: unknown) => Number(v ?? 0);
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * The bulk payment run: Finance picks a category and a month, ticks the payables to pay, adjusts each amount (all or part) and creates
 * the payment requests in one go. Each row is validated on its own with the same rules as a single request plus the category's
 * conditions, so one bad row never blocks the rest. Approval (a different person) and the Head Office pack follow as bulk steps.
 */
export class HoRunService {
    static categories() {
        return (Object.keys(PAYMENT_CATEGORIES) as PaymentCategory[]).map((key) => ({ key, ...PAYMENT_CATEGORIES[key] }));
    }

    /** What can be paid in a category up to the end of the month, with what is already requested. */
    static async payables(userId: string, category: PaymentCategory | undefined, month?: string) {
        const plan = await HoMonthlyService.plan(userId, month);
        const rows = plan.rows.filter((r) => !category || r.category === category);
        return { month: plan.month, rows };
    }

    /** The amount still payable on a source document, and what is needed to raise a voucher for it. */
    private static async resolve(item: RunItem) {
        if (item.kind === 'VENDOR') {
            const si = await prisma.supplierInvoice.findUnique({ where: { id: item.id }, include: { vendor: { select: { name: true } } } });
            if (!si) throw AppError.notFound('Supplier invoice not found');
            if (!['APPROVED', 'PARTIALLY_PAID'].includes(si.status)) throw AppError.badRequest('THE_INVOICE_MUST_BE_APPROVED_BEFORE_PAYMENT');
            const live = await prisma.paymentVoucher.aggregate({ where: { supplierInvoiceId: si.id, status: { notIn: ['CANCELLED', 'REJECTED'] } }, _sum: { amount: true } });
            return { label: `${si.vendor.name} · ${si.invoiceNumber}`, category: categoryOfSupplierInvoice(si.category), payable: round2(num(si.totalAmount) - num(live._sum.amount)), projectId: null as string | null, create: { supplierInvoiceId: si.id, payeeName: si.vendor.name, title: `Payment of ${si.invoiceNumber}` } };
        }
        if (item.kind === 'CONTRACTOR') {
            const inv = await prisma.projectInvoice.findUnique({ where: { id: item.id }, include: { contractor: { select: { id: true, name: true } } } });
            if (!inv || inv.type !== 'CONTRACTOR' || !inv.contractor) throw AppError.notFound('Contractor invoice not found');
            const live = await prisma.paymentVoucher.aggregate({ where: { invoiceId: inv.id, status: { notIn: ['CANCELLED', 'REJECTED'] } }, _sum: { amount: true } });
            return { label: `${inv.contractor.name} · ${inv.invoiceNumber}`, category: 'PROJECT_CONTRACTOR' as PaymentCategory, payable: round2(num(inv.totalAmount) - num(live._sum.amount)), projectId: inv.projectId, create: { projectId: inv.projectId, invoiceId: inv.id, type: 'CONTRACTOR', payeeId: inv.contractor.id, payeeName: inv.contractor.name, title: `Payment of ${inv.invoiceNumber}` } };
        }
        const sod = await prisma.invoice.findUnique({ where: { id: item.id }, include: { contractor: { select: { id: true, name: true, opmcId: true } } } });
        if (!sod) throw AppError.notFound('Contractor invoice not found');
        if (sod.approvalStatus !== 'APPROVED') throw AppError.badRequest('THE_CONTRACTOR_INVOICE_MUST_BE_APPROVED_FIRST');
        const live = await prisma.paymentVoucher.aggregate({ where: { description: { startsWith: `BOM_INVOICING_REF:${sod.id}` }, status: { notIn: ['CANCELLED', 'REJECTED'] } }, _sum: { amount: true } });
        return { label: `${sod.contractor.name} · ${sod.invoiceNumber}`, category: 'SOD_CONTRACTOR' as PaymentCategory, payable: round2(num(sod.amount) - num(live._sum.amount)), projectId: sod.projectId, opmcId: (sod.opmcId ?? sod.contractor.opmcId) as string | null, create: { projectId: sod.projectId, contractorInvoiceId: sod.id, type: 'CONTRACTOR', payeeId: sod.contractor.id, payeeName: sod.contractor.name, title: `Payment of ${sod.invoiceNumber}` } };
    }

    /** Create a payment request for each selected payable, optionally submitting each for approval. */
    static async createRequests(userId: string, items: RunItem[], submitForApproval = true): Promise<RunResult[]> {
        if (items.length === 0) throw AppError.badRequest('Choose at least one payable');
        if (items.length > 100) throw AppError.badRequest('A run is limited to 100 payables');
        const seen = new Set<string>();
        const results: RunResult[] = [];
        for (const item of items) {
            const key = `${item.kind}:${item.id}`;
            let label = key;
            try {
                if (seen.has(key)) throw AppError.badRequest('THE_SAME_PAYABLE_WAS_SELECTED_TWICE');
                seen.add(key);
                const r = await this.resolve(item);
                label = r.label;
                if (r.projectId) await assertProjectAccess(r.projectId, userId);
                // A contractor (SOD) invoice has no project: it follows the area of its contractor
                else if (item.kind === 'SOD') await assertContractorAreaAccess((r as { opmcId?: string | null }).opmcId, userId);
                const blocker = requestBlocker(r.category, { amount: item.amount, payable: r.payable, retention: item.retentionAmount, taxWithheld: item.taxWithheld });
                if (blocker) throw AppError.badRequest(blocker);
                const pv = await PaymentVoucherService.createPaymentVoucher({ ...r.create, amount: item.amount, taxWithheld: item.taxWithheld ?? 0, retentionAmount: item.retentionAmount ?? 0, paymentMethod: 'HEAD_OFFICE', createdById: userId });
                if (submitForApproval) await PaymentVoucherService.updatePaymentVoucherStatus(pv.id, 'PENDING_APPROVAL', userId);
                results.push({ kind: item.kind, id: item.id, label, ok: true, voucherId: pv.id, pvNumber: pv.pvNumber });
            } catch (e) {
                results.push({ kind: item.kind, id: item.id, label, ok: false, error: msg(e) });
            }
        }
        return results;
    }

    /** Approve many requests; each goes through the normal transition, so maker != approver and approval limits apply per request. */
    static async approveRequests(userId: string, voucherIds: string[]): Promise<{ voucherId: string; pvNumber: string; ok: boolean; error?: string }[]> {
        if (voucherIds.length === 0) throw AppError.badRequest('Choose at least one request');
        if (voucherIds.length > 100) throw AppError.badRequest('At most 100 requests at a time');
        const out: { voucherId: string; pvNumber: string; ok: boolean; error?: string }[] = [];
        for (const id of [...new Set(voucherIds)]) {
            const v = await prisma.paymentVoucher.findUnique({ where: { id }, select: { pvNumber: true, projectId: true, status: true, description: true } });
            if (!v) { out.push({ voucherId: id, pvNumber: id, ok: false, error: 'VOUCHER_NOT_FOUND' }); continue; }
            try {
                await assertVoucherAccess(v.projectId, userId, v.description);
                if (v.status !== 'PENDING_APPROVAL') throw AppError.badRequest('ONLY_REQUESTS_WAITING_FOR_APPROVAL_CAN_BE_APPROVED');
                await PaymentVoucherService.updatePaymentVoucherStatus(id, 'APPROVED', userId);
                out.push({ voucherId: id, pvNumber: v.pvNumber, ok: true });
            } catch (e) {
                out.push({ voucherId: id, pvNumber: v.pvNumber, ok: false, error: msg(e) });
            }
        }
        return out;
    }

    /** Requests waiting for approval (to approve in bulk) and approved ones not yet in a pack (to send), with their category. */
    static async queue(userId: string) {
        const rows = await prisma.paymentVoucher.findMany({
            where: { status: { in: ['PENDING_APPROVAL', 'APPROVED'] }, hoBatchId: null },
            orderBy: { createdAt: 'asc' }, take: 300,
            select: { id: true, pvNumber: true, status: true, type: true, payeeName: true, amount: true, taxWithheld: true, netAmount: true, createdById: true, approvedById: true, projectId: true, supplierInvoiceId: true, invoiceId: true, description: true, project: { select: { name: true, opmcId: true } } },
        });
        const scope = await resolveOpmcScope(userId, 'finance');
        const sodAreas = new Map<string, string | null>();
        const sodIds = rows.map((r) => (r.projectId ? null : sodInvoiceIdOf(r.description))).filter((x): x is string => !!x);
        if (scope !== undefined && sodIds.length) for (const i of await prisma.invoice.findMany({ where: { id: { in: sodIds } }, select: { id: true, opmcId: true, contractor: { select: { opmcId: true } } } })) sodAreas.set(i.id, i.opmcId ?? i.contractor?.opmcId ?? null);
        const visible = rows.filter((r) => scope === undefined || areaAllows(scope, r.project?.opmcId ?? (r.projectId ? null : (sodAreas.get(sodInvoiceIdOf(r.description) ?? '') ?? null))));
        const siIds = visible.map((r) => r.supplierInvoiceId).filter((x): x is string => !!x);
        const sis = siIds.length ? await prisma.supplierInvoice.findMany({ where: { id: { in: siIds } }, select: { id: true, category: true } }) : [];
        const catOf = new Map(sis.map((s) => [s.id, categoryOfSupplierInvoice(s.category)]));
        return visible.map((r) => ({
            id: r.id, pvNumber: r.pvNumber, status: r.status, payee: r.payeeName, project: r.project?.name ?? null, amount: num(r.amount), taxWithheld: num(r.taxWithheld), net: num(r.netAmount), createdById: r.createdById, approvedById: r.approvedById,
            category: r.supplierInvoiceId ? (catOf.get(r.supplierInvoiceId) ?? 'VENDOR_GOODS') : (r.description ?? '').startsWith('BOM_INVOICING_REF:') ? 'SOD_CONTRACTOR' : 'PROJECT_CONTRACTOR',
        }));
    }
}

