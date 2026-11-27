import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { AppError } from '@/lib/error';
import { AuditService } from '@/services/audit/audit.service';
import { LedgerService } from '@/services/finance/ledger.service';
import { ACCOUNTS } from '@/services/finance/account-codes';
import { userHasPermission } from '@/lib/user-permissions';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { isGrnInvoiceAbovePo } from '@/lib/grn-gate';
import { threeWayMatch, invoicePosting, dueDateFrom, isAbovePoPrice, type MatchLine, type MatchOutcome } from '@/lib/procurement-rules';
import { PAYMENT_CATEGORIES, isServiceCategory, type ServiceCategory } from '@/config/payment-categories';
import { ApprovalLimitService } from '@/services/procurement/approval-limit.service';

export type PoKind = 'STORE' | 'PROJECT';

export interface PoMatchContext {
    kind: PoKind;
    poId: string;
    poNumber: string;
    vendorId: string | null;
    vendorName: string;
    currency: string;
    /** The PO's own payment terms (project orders carry them), used when the vendor has none. */
    paymentTerms?: string | null;
    lines: { poItemId: string; description: string; orderedQty: number; orderedPrice: number; receivedQty: number; invoicedBefore: number; billable: number }[];
}

export interface CreateSupplierInvoiceInput {
    kind: PoKind;
    poId: string;
    userId: string;
    invoiceNumber: string;
    invoiceDate: string;
    dueDate?: string | null;
    lines: { poItemId: string; quantity: number; unitPrice: number; taxAmount?: number }[];
}

export interface CreateServiceInvoiceInput {
    userId: string;
    category: ServiceCategory;
    vendorId: string;
    invoiceNumber: string;
    invoiceDate: string;
    dueDate?: string | null;
    /** YYYY-MM the service covers */
    periodMonth?: string | null;
    sourceType?: string | null;
    sourceId?: string | null;
    opmcId?: string | null;
    lines: { description: string; quantity?: number; unitPrice: number; taxAmount?: number }[];
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Supplier invoices and the 3-way match: what the vendor bills against what was ordered (PO) and what was received (accepted
 * goods). The match result is stored with the invoice; an invoice that does not match can only be approved with a reason.
 * Approval clears the receipt accrual and books the vendor payable in the ledger.
 */
export class SupplierInvoiceService {
    /** The PO lines with what has been received and what other invoices already bill: the starting point of a new invoice. */
    static async getPoContext(kind: PoKind, poId: string): Promise<PoMatchContext> {
        if (kind === 'STORE') {
            const po = await prisma.purchaseOrder.findUnique({ where: { id: poId }, include: { items: { include: { stockRequestItem: { include: { item: { select: { code: true, name: true } } } } } } } });
            if (!po) throw AppError.notFound('Purchase order not found');
            const billed = await this.billedByLine(po.items.map((l) => l.id));
            return {
                kind, poId, poNumber: po.poNumber, vendorId: po.vendorId, vendorName: po.vendor, currency: po.currency,
                lines: po.items.map((l) => {
                    const received = Number(l.receivedQty);
                    const before = billed.get(l.id) ?? 0;
                    return { poItemId: l.id, description: `${l.stockRequestItem.item.code} ${l.stockRequestItem.item.name}`, orderedQty: Number(l.quantity), orderedPrice: Number(l.unitPrice), receivedQty: received, invoicedBefore: before, billable: Math.max(0, received - before) };
                }),
            };
        }
        const po = await prisma.projectPurchaseOrder.findUnique({ where: { id: poId }, include: { items: true } });
        if (!po) throw AppError.notFound('Purchase order not found');
        // Only goods receipts that have been approved count as received for billing purposes
        const approved = await prisma.projectGoodsReceiptItem.groupBy({
            by: ['poItemId'],
            where: { poItemId: { in: po.items.map((l) => l.id) }, goodsReceipt: { status: 'APPROVED' } },
            _sum: { quantityAccepted: true },
        });
        const receivedBy = new Map(approved.map((a) => [a.poItemId, Number(a._sum.quantityAccepted ?? 0)]));
        const billed = await this.billedByLine(po.items.map((l) => l.id));
        return {
            kind, poId, poNumber: po.poNumber, vendorId: po.vendorId, vendorName: po.vendorName, currency: po.currency, paymentTerms: po.paymentTerms,
            lines: po.items.map((l) => {
                const received = receivedBy.get(l.id) ?? 0;
                const before = billed.get(l.id) ?? 0;
                return { poItemId: l.id, description: `${l.itemCode} ${l.description}`, orderedQty: Number(l.quantity), orderedPrice: Number(l.unitPrice), receivedQty: received, invoicedBefore: before, billable: Math.max(0, received - before) };
            }),
        };
    }

    /** Units already billed per PO line on invoices that have not been rejected. */
    private static async billedByLine(poItemIds: string[]): Promise<Map<string, number>> {
        if (poItemIds.length === 0) return new Map();
        const rows = await prisma.supplierInvoiceItem.groupBy({
            by: ['poItemId'],
            where: { poItemId: { in: poItemIds }, invoice: { status: { not: 'REJECTED' } } },
            _sum: { quantity: true },
        });
        return new Map(rows.filter((r) => r.poItemId !== null).map((r) => [r.poItemId as string, Number(r._sum.quantity ?? 0)]));
    }

    /**
     * The vendor's invoice for one GRN (company flow: one invoice per delivery), created in the GRN's own transaction so the receipt and its invoice
     * are saved together or not at all. Lines are the accepted quantities of the GRN; the vendor's goods value is spread over them in proportion to
     * their PO value, so a vendor price that differs from the PO shows up in the 3-way match as a price variance. Tax is spread the same way.
     */
    static async createFromGrnTx(tx: Prisma.TransactionClient, input: {
        grnId: string; grnNumber: string; poId: string; userId: string; invoiceNumber: string; invoiceDate: Date; goods: number; tax: number; dueDate: Date | null;
        lines: { poItemId: string; quantity: number }[];
    }) {
        const po = await tx.purchaseOrder.findUnique({ where: { id: input.poId }, include: { items: { include: { stockRequestItem: { include: { item: { select: { code: true, name: true } } } } } } } });
        if (!po) throw AppError.notFound('Purchase order not found');
        if (!po.vendorId) throw AppError.badRequest('This purchase order has no vendor record: link a vendor to the order before receiving it with an invoice');
        const byId = new Map(po.items.map((l) => [l.id, l]));
        const merged = new Map<string, number>();
        for (const l of input.lines) {
            if (!byId.has(l.poItemId)) throw AppError.badRequest('A GRN line does not belong to this purchase order');
            if (l.quantity > 0) merged.set(l.poItemId, (merged.get(l.poItemId) ?? 0) + l.quantity);
        }
        if (merged.size === 0) throw AppError.badRequest('Nothing was accepted on this GRN, so there is nothing to invoice');
        const entries = [...merged.entries()];
        const poValue = entries.reduce((a, [id, q]) => a + q * Number(byId.get(id)!.unitPrice), 0);
        const goods = round2(input.goods);
        const tax = round2(input.tax);
        if (isGrnInvoiceAbovePo(goods, poValue)) {
            throw AppError.badRequest(`INVOICE_ABOVE_PO_PRICE: the vendor invoice value of the goods (Rs. ${goods.toLocaleString('en-LK')}) is above the PO value of the accepted goods (Rs. ${round2(poValue).toLocaleString('en-LK')}). The PO price approved by HO is the most that can be paid: ask the vendor for an invoice at the PO price`);
        }
        // spread goods and tax over the lines by PO value; the last line takes the rounding remainder
        let goodsLeft = goods;
        let taxLeft = tax;
        const lines = entries.map(([poItemId, quantity], i) => {
            const share = poValue > 0 ? (quantity * Number(byId.get(poItemId)!.unitPrice)) / poValue : 1 / entries.length;
            const last = i === entries.length - 1;
            const lineGoods = last ? goodsLeft : round2(goods * share);
            const lineTax = last ? taxLeft : round2(tax * share);
            goodsLeft = round2(goodsLeft - lineGoods);
            taxLeft = round2(taxLeft - lineTax);
            return { poItemId, quantity, unitPrice: quantity > 0 ? Math.round((lineGoods / quantity) * 100) / 100 : 0, taxAmount: lineTax, amount: round2(lineGoods + lineTax) };
        });
        const billedRows = await tx.supplierInvoiceItem.groupBy({ by: ['poItemId'], where: { poItemId: { in: [...merged.keys()] }, invoice: { status: { not: 'REJECTED' } } }, _sum: { quantity: true } });
        const billed = new Map(billedRows.map((r) => [r.poItemId as string, Number(r._sum.quantity ?? 0)]));
        const outcome: MatchOutcome = threeWayMatch(lines.map((l) => {
            const p = byId.get(l.poItemId)!;
            return { poItemId: l.poItemId, description: `${p.stockRequestItem.item.code} ${p.stockRequestItem.item.name}`, orderedQty: Number(p.quantity), orderedPrice: Number(p.unitPrice), receivedQty: Number(p.receivedQty), invoicedBefore: billed.get(l.poItemId) ?? 0, invoiceQty: l.quantity, invoicePrice: l.unitPrice };
        }));
        try {
            const invoice = await tx.supplierInvoice.create({
                data: {
                    invoiceNumber: input.invoiceNumber.trim(), vendorId: po.vendorId, storePoId: po.id, grnId: input.grnId,
                    invoiceDate: input.invoiceDate, dueDate: input.dueDate, currency: po.currency,
                    subtotal: goods, taxAmount: tax, totalAmount: round2(goods + tax),
                    status: outcome.status === 'MATCHED' ? 'MATCHED' : 'VARIANCE', matchStatus: outcome.status,
                    matchDetail: JSON.parse(JSON.stringify({ lines: outcome.lines, grnNumber: input.grnNumber })),
                    createdById: input.userId,
                    items: { create: lines.map((l) => ({ poItemId: l.poItemId, description: `${byId.get(l.poItemId)!.stockRequestItem.item.code} ${byId.get(l.poItemId)!.stockRequestItem.item.name}`, quantity: l.quantity, unitPrice: l.unitPrice, taxAmount: l.taxAmount, amount: l.amount })) },
                },
            });
            AuditService.log({ userId: input.userId, action: 'CREATE_SUPPLIER_INVOICE_FROM_GRN', entity: 'SUPPLIER_INVOICE', entityId: invoice.id, newValue: { invoiceNumber: invoice.invoiceNumber, po: po.poNumber, grn: input.grnNumber, total: Number(invoice.totalAmount), match: outcome.status } }).catch(() => undefined);
            return invoice;
        } catch (error) {
            if ((error as { code?: string }).code === 'P2002') throw AppError.conflict('This vendor invoice number has already been entered for this vendor');
            throw error;
        }
    }

    static async create(input: CreateSupplierInvoiceInput) {
        const { kind, poId, userId } = input;
        if (!input.invoiceNumber?.trim()) throw AppError.badRequest('Enter the vendor invoice number');
        if (!input.lines?.length) throw AppError.badRequest('Add at least one invoice line');
        const ctx = await this.getPoContext(kind, poId);
        if (!ctx.vendorId) throw AppError.badRequest('This purchase order has no vendor record: link a vendor to the order before invoicing it');

        const byId = new Map(ctx.lines.map((l) => [l.poItemId, l]));
        const merged = new Map<string, { quantity: number; unitPrice: number; taxAmount: number }>();
        for (const l of input.lines) {
            if (!byId.has(l.poItemId)) throw AppError.badRequest('An invoice line does not belong to this purchase order');
            if (!(l.quantity > 0) || l.unitPrice < 0 || (l.taxAmount ?? 0) < 0) throw AppError.badRequest('Invoice quantities must be positive and prices cannot be negative');
            const prev = merged.get(l.poItemId);
            merged.set(l.poItemId, { quantity: (prev?.quantity ?? 0) + l.quantity, unitPrice: l.unitPrice, taxAmount: (prev?.taxAmount ?? 0) + (l.taxAmount ?? 0) });
        }

        const above = [...merged.entries()].filter(([poItemId, m]) => isAbovePoPrice(m.unitPrice, byId.get(poItemId)!.orderedPrice));
        if (above.length > 0) {
            throw AppError.badRequest(`INVOICE_ABOVE_PO_PRICE: the PO price approved by HO is the most that can be paid; above it: ${above.map(([poItemId, m]) => `${byId.get(poItemId)!.description} invoiced at ${m.unitPrice}, PO price ${byId.get(poItemId)!.orderedPrice}`).join('; ')}`);
        }
        const vendorTerms = (await prisma.vendor.findUnique({ where: { id: ctx.vendorId }, select: { paymentTerms: true } }))?.paymentTerms;
        const matchLines: MatchLine[] = [...merged.entries()].map(([poItemId, m]) => {
            const c = byId.get(poItemId)!;
            return { poItemId, description: c.description, orderedQty: c.orderedQty, orderedPrice: c.orderedPrice, receivedQty: c.receivedQty, invoicedBefore: c.invoicedBefore, invoiceQty: m.quantity, invoicePrice: m.unitPrice };
        });
        const outcome: MatchOutcome = threeWayMatch(matchLines);

        const subtotal = round2([...merged.values()].reduce((a, m) => a + m.quantity * m.unitPrice, 0));
        const tax = round2([...merged.values()].reduce((a, m) => a + m.taxAmount, 0));

        try {
            const invoice = await prisma.supplierInvoice.create({
                data: {
                    invoiceNumber: input.invoiceNumber.trim(),
                    vendorId: ctx.vendorId,
                    storePoId: kind === 'STORE' ? poId : null,
                    projectPoId: kind === 'PROJECT' ? poId : null,
                    invoiceDate: new Date(input.invoiceDate),
                    dueDate: input.dueDate ? new Date(input.dueDate) : dueDateFrom(input.invoiceDate, vendorTerms, ctx.paymentTerms),
                    currency: ctx.currency,
                    subtotal, taxAmount: tax, totalAmount: round2(subtotal + tax),
                    status: outcome.status === 'MATCHED' ? 'MATCHED' : 'VARIANCE',
                    matchStatus: outcome.status,
                    matchDetail: JSON.parse(JSON.stringify({ lines: outcome.lines })),
                    createdById: userId,
                    items: {
                        create: [...merged.entries()].map(([poItemId, m]) => ({
                            poItemId, description: byId.get(poItemId)!.description, quantity: m.quantity, unitPrice: m.unitPrice, taxAmount: m.taxAmount, amount: round2(m.quantity * m.unitPrice + m.taxAmount),
                        })),
                    },
                },
                include: { items: true },
            });
            AuditService.log({ userId, action: 'CREATE_SUPPLIER_INVOICE', entity: 'SUPPLIER_INVOICE', entityId: invoice.id, newValue: { invoiceNumber: invoice.invoiceNumber, po: ctx.poNumber, total: Number(invoice.totalAmount), match: outcome.status } }).catch(() => undefined);
            return invoice;
        } catch (error) {
            if ((error as { code?: string }).code === 'P2002') throw AppError.conflict('This vendor invoice number has already been entered for this vendor');
            throw error;
        }
    }

    /**
     * A service invoice (site office rent, vehicle hire, other services) has no purchase order and nothing to receive, so there is no
     * 3-way match: it is entered, approved by a different person, and then paid like any other vendor invoice.
     */
    static async createService(input: CreateServiceInvoiceInput) {
        if (!isServiceCategory(input.category)) throw AppError.badRequest('INVALID_SERVICE_CATEGORY');
        if (!input.invoiceNumber?.trim()) throw AppError.badRequest('Enter the vendor invoice number');
        if (!input.lines?.length) throw AppError.badRequest('Add at least one invoice line');
        if (input.periodMonth && !/^\d{4}-(0[1-9]|1[0-2])$/.test(input.periodMonth)) throw AppError.badRequest('periodMonth must look like YYYY-MM');
        const vendor = await prisma.vendor.findUnique({ where: { id: input.vendorId }, select: { id: true, name: true, paymentTerms: true } });
        if (!vendor) throw AppError.badRequest('VENDOR_NOT_FOUND');
        for (const l of input.lines) {
            if (!l.description?.trim() || !(l.unitPrice >= 0) || !((l.quantity ?? 1) > 0) || (l.taxAmount ?? 0) < 0) throw AppError.badRequest('Each line needs a description, a positive quantity and a price that is not negative');
        }
        const lines = input.lines.map((l) => ({ description: l.description.trim(), quantity: l.quantity ?? 1, unitPrice: l.unitPrice, taxAmount: l.taxAmount ?? 0 }));
        const subtotal = round2(lines.reduce((a, l) => a + l.quantity * l.unitPrice, 0));
        const tax = round2(lines.reduce((a, l) => a + l.taxAmount, 0));
        if (!(subtotal + tax > 0)) throw AppError.badRequest('The invoice total must be above zero');
        if (input.sourceType && input.sourceId && input.periodMonth) {
            const billed = await prisma.supplierInvoice.findFirst({ where: { sourceType: input.sourceType, sourceId: input.sourceId, periodMonth: input.periodMonth }, select: { invoiceNumber: true } });
            if (billed) throw AppError.conflict(`This month has already been billed for this agreement or vehicle (${billed.invoiceNumber})`);
        }
        try {
            const invoice = await prisma.supplierInvoice.create({
                data: {
                    invoiceNumber: input.invoiceNumber.trim(), vendorId: vendor.id, storePoId: null, projectPoId: null,
                    invoiceDate: new Date(input.invoiceDate),
                    dueDate: input.dueDate ? new Date(input.dueDate) : dueDateFrom(input.invoiceDate, vendor.paymentTerms, null),
                    currency: 'LKR', subtotal, taxAmount: tax, totalAmount: round2(subtotal + tax),
                    status: 'MATCHED', matchStatus: 'NOT_APPLICABLE', createdById: input.userId,
                    category: input.category, periodMonth: input.periodMonth ?? null, sourceType: input.sourceType ?? null, sourceId: input.sourceId ?? null, opmcId: input.opmcId ?? null,
                    items: { create: lines.map((l) => ({ poItemId: null, description: l.description, quantity: l.quantity, unitPrice: l.unitPrice, taxAmount: l.taxAmount, amount: round2(l.quantity * l.unitPrice) })) },
                },
                include: { items: true },
            });
            AuditService.log({ userId: input.userId, action: 'CREATE_SERVICE_INVOICE', entity: 'SUPPLIER_INVOICE', entityId: invoice.id, newValue: { invoiceNumber: invoice.invoiceNumber, category: input.category, vendor: vendor.name, total: Number(invoice.totalAmount), periodMonth: input.periodMonth } }).catch(() => undefined);
            return invoice;
        } catch (error) {
            if ((error as { code?: string }).code === 'P2002') {
                const target = JSON.stringify((error as { meta?: { target?: unknown } }).meta?.target ?? '');
                if (/sourceType|periodMonth|sourceId/.test(target)) throw AppError.conflict('This month has already been billed for this agreement or vehicle');
                throw AppError.conflict('This vendor invoice number has already been entered for this vendor');
            }
            throw error;
        }
    }

    /** Approving a service invoice: expense (and input VAT) against the vendor payable. */
    private static async approveService(invoice: { id: string; invoiceNumber: string; category: string; subtotal: unknown; taxAmount: unknown; totalAmount: unknown; invoiceDate: Date; createdById: string; periodMonth: string | null }, userId: string) {
        const rule = PAYMENT_CATEGORIES[invoice.category as ServiceCategory];
        if (!rule?.expenseAccount) throw AppError.badRequest('INVALID_SERVICE_CATEGORY');
        const total = round2(Number(invoice.totalAmount));
        await ApprovalLimitService.assertCanApprove(userId, total, 'SUPPLIER_INVOICE', invoice.id);
        const subtotal = round2(Number(invoice.subtotal));
        const tax = round2(Number(invoice.taxAmount));
        const invDate = new Date(invoice.invoiceDate);
        const period = await prisma.fiscalPeriod.findUnique({ where: { year_month: { year: invDate.getFullYear(), month: invDate.getMonth() + 1 } } });
        const postingDate = !period || period.status === 'OPEN' ? invDate : new Date();
        return prisma.$transaction(async (tx) => {
            const claim = await tx.supplierInvoice.updateMany({ where: { id: invoice.id, status: { in: ['MATCHED', 'VARIANCE', 'DRAFT'] } }, data: { status: 'APPROVED', approvedById: userId, approvedAt: new Date() } });
            if (claim.count === 0) throw AppError.conflict('This invoice has already been actioned');
            const lines = [
                { accountCode: rule.expenseAccount!, debit: subtotal, credit: 0, description: `${rule.label}${invoice.periodMonth ? ' ' + invoice.periodMonth : ''}: ${invoice.invoiceNumber}` },
                ...(tax > 0 ? [{ accountCode: ACCOUNTS.INPUT_VAT, debit: tax, credit: 0, description: 'Input VAT on service invoice' }] : []),
                { accountCode: ACCOUNTS.AP_VENDOR, debit: 0, credit: total, description: `Service invoice ${invoice.invoiceNumber}` },
            ].filter((l) => l.debit > 0 || l.credit > 0);
            const entry = await LedgerService.postTransaction(tx, {
                referenceId: invoice.id, referenceType: 'SUPPLIER_INVOICE', idempotencyKey: `SUPPLIER_INVOICE_${invoice.id}`, isAutoGenerated: true, date: postingDate,
                description: `Service invoice ${invoice.invoiceNumber} (${rule.label})`, lines,
            });
            const updated = await tx.supplierInvoice.update({ where: { id: invoice.id }, data: { journalEntryId: entry?.id ?? null }, include: { items: true } });
            AuditService.log({ userId, action: 'APPROVE_SERVICE_INVOICE', entity: 'SUPPLIER_INVOICE', entityId: invoice.id, newValue: { total, category: invoice.category } }).catch(() => undefined);
            return updated;
        }, { maxWait: 10_000, timeout: 30_000 });
    }

    /**
     * Approve: a different person from the one who entered it (administrators are exempt), and a mismatched invoice needs a reason.
     * Posts DR accrued payable (the goods received at PO price) + DR/CR inventory for any price difference and tax, CR vendor payable.
     */
    static async approve(id: string, userId: string, overrideReason?: string | null, opts?: { viaVoucherChain?: boolean }) {
        const invoice = await prisma.supplierInvoice.findUnique({ where: { id }, include: { items: true } });
        if (!invoice) throw AppError.notFound('Supplier invoice not found');
        if (invoice.status === 'APPROVED' || invoice.status === 'PAID') throw AppError.conflict('This invoice has already been approved');
        if (invoice.status === 'REJECTED') throw AppError.badRequest('A rejected invoice cannot be approved');
        const isAdmin = await userHasPermission(userId, RBAC_PERMISSIONS.ADMIN_RBAC);
        if (invoice.createdById === userId && !isAdmin) {
            AuditService.log({ userId, action: 'SOD_VIOLATION_BLOCKED', entity: 'SUPPLIER_INVOICE', entityId: id, newValue: { reason: 'creator tried to approve own invoice' } }).catch(() => undefined);
            throw AppError.badRequest('SEGREGATION_OF_DUTIES_VIOLATION: the person who entered an invoice cannot approve it');
        }
        // One approval (owner, 26 Nov 2026: the CEO's approval of large payments is given in the HO system, not here).
        // A voucher-chain approval was already checked step by step: the Head of Section signs the last step without finance.approve.
        if (!isAdmin && !opts?.viaVoucherChain && !(await userHasPermission(userId, RBAC_PERMISSIONS.FINANCE_APPROVE))) {
            throw AppError.forbidden('Approving a supplier invoice needs finance approval access');
        }
        if (invoice.category !== 'PO_GOODS') return this.approveService(invoice, userId);

        // The 3-way match is run again now: the result saved when the invoice was entered goes stale when a receipt is returned,
        // corrected or another invoice bills the same lines. This invoice's own quantities are taken out of "already billed".
        const ctx = await this.getPoContext(invoice.storePoId ? 'STORE' : 'PROJECT', (invoice.storePoId ?? invoice.projectPoId)!);
        const ctxLine = new Map(ctx.lines.map((l) => [l.poItemId, l]));
        const ownQty = new Map<string, number>();
        for (const i of invoice.items) if (i.poItemId) ownQty.set(i.poItemId, (ownQty.get(i.poItemId) ?? 0) + Number(i.quantity));
        const recheck = threeWayMatch(invoice.items.filter((i) => i.poItemId && ctxLine.has(i.poItemId)).map((i) => {
            const c = ctxLine.get(i.poItemId!)!;
            return { poItemId: c.poItemId, description: c.description, orderedQty: c.orderedQty, orderedPrice: c.orderedPrice, receivedQty: c.receivedQty, invoicedBefore: Math.max(0, c.invoicedBefore - (ownQty.get(c.poItemId) ?? 0)), invoiceQty: Number(i.quantity), invoicePrice: Number(i.unitPrice) };
        }));
        if (recheck.lines.some((l) => l.result === 'ABOVE_PO_PRICE')) {
            throw AppError.badRequest('INVOICE_ABOVE_PO_PRICE: this invoice bills above the PO price approved by HO and cannot be approved, with or without a reason; reject it and ask the vendor for an invoice at the PO price');
        }
        if (recheck.status !== 'MATCHED' && !(overrideReason && overrideReason.trim().length >= 5)) {
            // Saved as a variance so the Supplier Invoices screen asks the finance approver for the reason
            if (invoice.status === 'MATCHED') {
                await prisma.supplierInvoice.updateMany({ where: { id, status: 'MATCHED' }, data: { status: 'VARIANCE', matchStatus: recheck.status, matchDetail: JSON.parse(JSON.stringify({ lines: recheck.lines, recheckedAtApproval: true })) } });
            }
            throw AppError.badRequest(invoice.matchStatus === 'MATCHED'
                ? 'MATCH_CHANGED_SINCE_ENTRY: the receipts or other invoices of this order changed since the invoice was entered and it no longer matches; check it, then give a reason to approve it'
                : 'MATCH_OVERRIDE_REASON_REQUIRED: this invoice does not match the order and receipts; give a reason to approve it');
        }
        const priceOf = new Map(ctx.lines.map((l) => [l.poItemId, l.orderedPrice]));
        const posting = invoicePosting(invoice.items.map((i) => ({ quantity: Number(i.quantity), invoicePrice: Number(i.unitPrice), orderPrice: priceOf.get(i.poItemId ?? '') ?? Number(i.unitPrice), taxAmount: Number(i.taxAmount) })));
        const accrued = posting.clearing;
        const total = posting.total;
        // Posting date: the invoice date when its fiscal period is still open, otherwise today (never a closed period)
        const invDate = new Date(invoice.invoiceDate);
        const period = await prisma.fiscalPeriod.findUnique({ where: { year_month: { year: invDate.getFullYear(), month: invDate.getMonth() + 1 } } });
        const postingDate = !period || period.status === 'OPEN' ? invDate : new Date();

        return prisma.$transaction(async (tx) => {
            const claim = await tx.supplierInvoice.updateMany({ where: { id, status: { in: ['MATCHED', 'VARIANCE', 'DRAFT'] } }, data: { status: 'APPROVED', approvedById: userId, approvedAt: new Date(), overrideReason: overrideReason?.trim() || invoice.overrideReason || null, matchStatus: recheck.status, matchDetail: JSON.parse(JSON.stringify({ lines: recheck.lines, recheckedAtApproval: true })) } });
            if (claim.count === 0) throw AppError.conflict('This invoice has already been actioned');
            const lines = [
                { accountCode: ACCOUNTS.AP_ACCRUED, debit: accrued, credit: 0, description: 'GR/IR cleared: goods received, now invoiced' },
                ...(posting.priceVariance > 0 ? [{ accountCode: ACCOUNTS.PPV, debit: posting.priceVariance, credit: 0, description: 'Invoice price above order price' }] : []),
                ...(posting.priceVariance < 0 ? [{ accountCode: ACCOUNTS.PPV, debit: 0, credit: -posting.priceVariance, description: 'Invoice price below order price' }] : []),
                ...(posting.tax > 0 ? [{ accountCode: ACCOUNTS.INPUT_VAT, debit: posting.tax, credit: 0, description: 'Input VAT on supplier invoice' }] : []),
                { accountCode: ACCOUNTS.AP_VENDOR, debit: 0, credit: total, description: `Supplier invoice ${invoice.invoiceNumber}` },
            ].filter((l) => l.debit > 0 || l.credit > 0);
            const entry = total > 0 ? await LedgerService.postTransaction(tx, {
                referenceId: id, referenceType: 'SUPPLIER_INVOICE', idempotencyKey: `SUPPLIER_INVOICE_${id}`, isAutoGenerated: true, date: postingDate,
                description: `Supplier invoice ${invoice.invoiceNumber} (${ctx.poNumber})`, lines,
            }) : null;
            const updated = await tx.supplierInvoice.update({ where: { id }, data: { journalEntryId: entry?.id ?? null }, include: { items: true } });
            AuditService.log({ userId, action: 'APPROVE_SUPPLIER_INVOICE', entity: 'SUPPLIER_INVOICE', entityId: id, newValue: { total, clearing: accrued, priceVariance: posting.priceVariance, inputVat: posting.tax, match: recheck.status, matchAtEntry: invoice.matchStatus, override: overrideReason ?? null } }).catch(() => undefined);
            return updated;
        }, { maxWait: 10_000, timeout: 30_000 });
    }

    static async reject(id: string, userId: string, reason: string) {
        if (!reason || reason.trim().length < 3) throw AppError.badRequest('A rejection reason is required');
        const claim = await prisma.supplierInvoice.updateMany({ where: { id, status: { in: ['MATCHED', 'VARIANCE', 'DRAFT'] } }, data: { status: 'REJECTED', rejectionReason: reason.trim() } });
        if (claim.count === 0) throw AppError.conflict('Only an invoice that has not been approved can be rejected');
        AuditService.log({ userId, action: 'REJECT_SUPPLIER_INVOICE', entity: 'SUPPLIER_INVOICE', entityId: id, newValue: { reason: reason.trim() } }).catch(() => undefined);
        return prisma.supplierInvoice.findUniqueOrThrow({ where: { id }, include: { items: true } });
    }

    static async list(filter: { status?: string; vendorId?: string } = {}) {
        return prisma.supplierInvoice.findMany({
            where: { ...(filter.status ? { status: filter.status } : {}), ...(filter.vendorId ? { vendorId: filter.vendorId } : {}) },
            orderBy: { createdAt: 'desc' },
            take: 300,
            include: { vendor: { select: { name: true, code: true } }, storePo: { select: { poNumber: true } }, projectPo: { select: { poNumber: true } }, items: true },
        });
    }
}
