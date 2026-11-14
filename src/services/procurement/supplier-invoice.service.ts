import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';
import { AuditService } from '@/services/audit/audit.service';
import { LedgerService } from '@/services/finance/ledger.service';
import { ACCOUNTS } from '@/services/finance/account-codes';
import { userHasPermission } from '@/lib/user-permissions';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { getProcurementConfig } from '@/services/procurement/procurement-config';
import { threeWayMatch, type MatchLine, type MatchOutcome } from '@/lib/procurement-rules';

export type PoKind = 'STORE' | 'PROJECT';

export interface PoMatchContext {
    kind: PoKind;
    poId: string;
    poNumber: string;
    vendorId: string | null;
    vendorName: string;
    currency: string;
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
            kind, poId, poNumber: po.poNumber, vendorId: po.vendorId, vendorName: po.vendorName, currency: po.currency,
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
        return new Map(rows.map((r) => [r.poItemId, Number(r._sum.quantity ?? 0)]));
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

        const cfg = await getProcurementConfig();
        const matchLines: MatchLine[] = [...merged.entries()].map(([poItemId, m]) => {
            const c = byId.get(poItemId)!;
            return { poItemId, description: c.description, orderedQty: c.orderedQty, orderedPrice: c.orderedPrice, receivedQty: c.receivedQty, invoicedBefore: c.invoicedBefore, invoiceQty: m.quantity, invoicePrice: m.unitPrice };
        });
        const outcome: MatchOutcome = threeWayMatch(matchLines, cfg.matchPriceTolerancePct);

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
                    dueDate: input.dueDate ? new Date(input.dueDate) : null,
                    currency: ctx.currency,
                    subtotal, taxAmount: tax, totalAmount: round2(subtotal + tax),
                    status: outcome.status === 'MATCHED' ? 'MATCHED' : 'VARIANCE',
                    matchStatus: outcome.status,
                    matchDetail: JSON.parse(JSON.stringify({ tolerancePct: cfg.matchPriceTolerancePct, lines: outcome.lines })),
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
     * Approve: a different person from the one who entered it (administrators are exempt), and a mismatched invoice needs a reason.
     * Posts DR accrued payable (the goods received at PO price) + DR/CR inventory for any price difference and tax, CR vendor payable.
     */
    static async approve(id: string, userId: string, overrideReason?: string | null) {
        const invoice = await prisma.supplierInvoice.findUnique({ where: { id }, include: { items: true } });
        if (!invoice) throw AppError.notFound('Supplier invoice not found');
        if (invoice.status === 'APPROVED' || invoice.status === 'PAID') throw AppError.conflict('This invoice has already been approved');
        if (invoice.status === 'REJECTED') throw AppError.badRequest('A rejected invoice cannot be approved');
        const isAdmin = await userHasPermission(userId, RBAC_PERMISSIONS.ADMIN_RBAC);
        if (invoice.createdById === userId && !isAdmin) {
            AuditService.log({ userId, action: 'SOD_VIOLATION_BLOCKED', entity: 'SUPPLIER_INVOICE', entityId: id, newValue: { reason: 'creator tried to approve own invoice' } }).catch(() => undefined);
            throw AppError.badRequest('SEGREGATION_OF_DUTIES_VIOLATION: the person who entered an invoice cannot approve it');
        }
        if (invoice.matchStatus !== 'MATCHED' && (!overrideReason || overrideReason.trim().length < 5)) {
            throw AppError.badRequest('MATCH_OVERRIDE_REASON_REQUIRED: this invoice does not match the order and receipts; give a reason to approve it');
        }

        const ctx = await this.getPoContext(invoice.storePoId ? 'STORE' : 'PROJECT', (invoice.storePoId ?? invoice.projectPoId)!);
        const priceOf = new Map(ctx.lines.map((l) => [l.poItemId, l.orderedPrice]));
        const accrued = round2(invoice.items.reduce((a, i) => a + Number(i.quantity) * (priceOf.get(i.poItemId) ?? 0), 0));
        const total = Number(invoice.totalAmount);
        const difference = round2(total - accrued);

        return prisma.$transaction(async (tx) => {
            const claim = await tx.supplierInvoice.updateMany({ where: { id, status: { in: ['MATCHED', 'VARIANCE', 'DRAFT'] } }, data: { status: 'APPROVED', approvedById: userId, approvedAt: new Date(), overrideReason: overrideReason?.trim() || null } });
            if (claim.count === 0) throw AppError.conflict('This invoice has already been actioned');
            const lines = [
                { accountCode: ACCOUNTS.AP_ACCRUED, debit: accrued, credit: 0, description: 'Goods received, now invoiced' },
                ...(difference > 0 ? [{ accountCode: ACCOUNTS.INVENTORY, debit: difference, credit: 0, description: 'Price difference and tax on supplier invoice' }] : []),
                ...(difference < 0 ? [{ accountCode: ACCOUNTS.INVENTORY, debit: 0, credit: -difference, description: 'Invoice below received value' }] : []),
                { accountCode: ACCOUNTS.AP_VENDOR, debit: 0, credit: total, description: `Supplier invoice ${invoice.invoiceNumber}` },
            ].filter((l) => l.debit > 0 || l.credit > 0);
            const entry = total > 0 ? await LedgerService.postTransaction(tx, {
                referenceId: id, referenceType: 'SUPPLIER_INVOICE', idempotencyKey: `SUPPLIER_INVOICE_${id}`, isAutoGenerated: true,
                description: `Supplier invoice ${invoice.invoiceNumber} (${ctx.poNumber})`, lines,
            }) : null;
            const updated = await tx.supplierInvoice.update({ where: { id }, data: { journalEntryId: entry?.id ?? null }, include: { items: true } });
            AuditService.log({ userId, action: 'APPROVE_SUPPLIER_INVOICE', entity: 'SUPPLIER_INVOICE', entityId: id, newValue: { total, accrued, difference, match: invoice.matchStatus, override: overrideReason ?? null } }).catch(() => undefined);
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

    static async markPaid(id: string, userId: string) {
        const claim = await prisma.supplierInvoice.updateMany({ where: { id, status: 'APPROVED' }, data: { status: 'PAID', paidAt: new Date() } });
        if (claim.count === 0) throw AppError.conflict('Only an approved invoice can be marked as paid');
        AuditService.log({ userId, action: 'PAY_SUPPLIER_INVOICE', entity: 'SUPPLIER_INVOICE', entityId: id, newValue: { status: 'PAID' } }).catch(() => undefined);
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
