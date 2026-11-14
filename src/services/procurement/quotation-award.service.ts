import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';
import { AuditService } from '@/services/audit/audit.service';
import { EmailService } from '@/services/notification/email.service';
import { NotificationTemplateEngineService } from '@/services/notification/template-engine.service';
import { ProjectPurchaseOrderService } from '@/services/project/project-purchase-order.service';
import { scoreQuotes } from '@/lib/procurement-rules';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const day = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : 'to be advised');

export interface QuoteInput {
    quotationId: string;
    userId: string;
    validUntil?: string | null;
    deliveryDays?: number | null;
    paymentTerms?: string | null;
    warrantyPeriod?: string | null;
    /** One price per requisition item; items left out are treated as not quoted and make the quotation incomplete. */
    prices: { requisitionItemId: string; unitPrice: number; deliveryDays?: number | null }[];
}

export interface ComparisonQuote {
    id: string; quoteNumber: string; vendorId: string; vendorName: string; status: string;
    total: number; deliveryDays: number | null; validUntil: string | null; paymentTerms: string | null;
    score: number | null; expired: boolean; lowest: boolean; complete: boolean;
    prices: Record<string, number | null>;
}

export interface Comparison {
    requisition: { id: string; prNumber: string; title: string; status: string; projectId: string };
    items: { id: string; itemCode: string; description: string; unit: string; quantity: number; estimatedPrice: number }[];
    quotes: ComparisonQuote[];
    awardedQuotationId: string | null;
}

/**
 * RFQ, quotation comparison and award for project requisitions.
 *
 * An RFQ creates a REQUESTED quotation per chosen vendor and emails the vendor. When the vendor's prices are entered the
 * quotation becomes RECEIVED. Awarding accepts one received quotation, rejects the other open ones for the requisition and
 * raises a DRAFT purchase order from the accepted quotation's lines. Nothing here approves or issues a purchase order.
 */
export class QuotationAwardService {
    private static async nextQuoteNumber(tx: Pick<typeof prisma, 'quotation'>): Promise<string> {
        const last = await tx.quotation.findFirst({ orderBy: { quoteNumber: 'desc' }, select: { quoteNumber: true } });
        const n = last?.quoteNumber ? parseInt(last.quoteNumber.replace('QTN-', ''), 10) : 0;
        return 'QTN-' + String((Number.isNaN(n) ? 0 : n) + 1).padStart(5, '0');
    }

    static async requestQuotations(requisitionId: string, vendorIds: string[], userId: string, replyByDays = 7) {
        if (vendorIds.length === 0) throw AppError.badRequest('Choose at least one vendor');
        const requisition = await prisma.projectRequisition.findUnique({ where: { id: requisitionId }, include: { items: true } });
        if (!requisition) throw AppError.notFound('Requisition not found');
        if (requisition.status !== 'APPROVED') throw AppError.badRequest('Quotations can only be requested for an approved requisition');
        if (requisition.items.length === 0) throw AppError.badRequest('The requisition has no items to quote');
        const alreadyAwarded = await prisma.quotation.count({ where: { requisitionId, status: 'ACCEPTED' } });
        if (alreadyAwarded > 0) throw AppError.badRequest('This requisition has already been awarded');

        const vendors = await prisma.vendor.findMany({ where: { id: { in: [...new Set(vendorIds)] } } });
        if (vendors.length !== new Set(vendorIds).size) throw AppError.badRequest('A selected vendor does not exist');
        const inactive = vendors.find((v) => v.status && v.status.toUpperCase() !== 'ACTIVE');
        if (inactive) throw AppError.badRequest(`Vendor ${inactive.name} is not active`);
        const existing = await prisma.quotation.findMany({ where: { requisitionId, vendorId: { in: vendors.map((v) => v.id) }, status: { in: ['REQUESTED', 'RECEIVED'] } }, select: { vendorId: true } });
        const skip = new Set(existing.map((q) => q.vendorId));

        const created: { id: string; quoteNumber: string; vendorName: string; emailed: boolean }[] = [];
        for (const vendor of vendors.filter((v) => !skip.has(v.id))) {
            const quote = await prisma.$transaction(async (tx) => {
                const quoteNumber = await this.nextQuoteNumber(tx);
                return tx.quotation.create({
                    data: { quoteNumber, requisitionId, vendorId: vendor.id, vendorName: vendor.name, status: 'REQUESTED', requestedAt: new Date(), totalAmount: 0, currency: 'LKR' },
                });
            });
            let emailed = false;
            if (vendor.email) {
                const itemsTable = `<table style="border-collapse:collapse;width:100%;font-size:13px;"><tr style="background:#f1f5f9;"><th align="left" style="padding:6px;border:1px solid #e2e8f0;">Item</th><th align="right" style="padding:6px;border:1px solid #e2e8f0;">Quantity</th><th align="left" style="padding:6px;border:1px solid #e2e8f0;">Unit</th></tr>${requisition.items.map((i) => `<tr><td style="padding:6px;border:1px solid #e2e8f0;">${esc(i.itemCode)} ${esc(i.description)}</td><td align="right" style="padding:6px;border:1px solid #e2e8f0;">${Number(i.quantity)}</td><td style="padding:6px;border:1px solid #e2e8f0;">${esc(i.unit)}</td></tr>`).join('')}</table>`;
                const vars = {
                    vendorName: vendor.name, quoteNumber: quote.quoteNumber, requisitionNumber: requisition.prNumber, title: requisition.title,
                    itemsTable, requiredDate: day(requisition.requiredDate), contactName: 'Procurement, SLTS', replyBy: day(new Date(Date.now() + replyByDays * 86_400_000)),
                };
                const rendered = await NotificationTemplateEngineService.renderEmailByCode('RFQ_REQUEST', vars);
                const subject = rendered?.subject ?? `Request for quotation ${quote.quoteNumber} - ${requisition.title}`;
                const html = rendered?.html ?? `<html><body style="font-family:Arial,sans-serif;padding:20px;color:#1e293b;"><h2>Request for quotation ${esc(quote.quoteNumber)}</h2><p>Dear ${esc(vendor.name)},</p><p>Please send your best quotation for requisition ${esc(requisition.prNumber)}: ${esc(requisition.title)}. Reply by ${vars.replyBy}.</p>${itemsTable}<p style="font-size:12px;color:#64748b;">SLTS Nexus ERP</p></body></html>`;
                const text = rendered?.text ?? `Request for quotation ${quote.quoteNumber}: please quote for ${requisition.title} (requisition ${requisition.prNumber}). Reply by ${vars.replyBy}.`;
                try {
                    await EmailService.sendMail({ to: vendor.email, subject, text, html });
                    emailed = true;
                } catch (error) {
                    console.warn('[RFQ] Email failed:', error instanceof Error ? error.message : error);
                }
            }
            created.push({ id: quote.id, quoteNumber: quote.quoteNumber, vendorName: vendor.name, emailed });
            AuditService.log({ userId, action: 'REQUEST_QUOTATION', entity: 'QUOTATION', entityId: quote.id, newValue: { requisition: requisition.prNumber, vendor: vendor.name, emailed } }).catch(() => undefined);
        }
        return { created, skippedVendors: skip.size };
    }

    /** Record what the vendor quoted. Every requisition item must be priced, so quotations compare like for like. */
    static async submitQuote(input: QuoteInput) {
        const quote = await prisma.quotation.findUnique({ where: { id: input.quotationId }, include: { requisition: { include: { items: true } } } });
        if (!quote) throw AppError.notFound('Quotation not found');
        if (!['REQUESTED', 'RECEIVED'].includes(quote.status)) throw AppError.badRequest(`A ${quote.status.toLowerCase()} quotation cannot be edited`);
        const items = quote.requisition.items;
        const priceBy = new Map(input.prices.map((p) => [p.requisitionItemId, p]));
        for (const it of items) {
            const p = priceBy.get(it.id);
            if (!p) throw AppError.badRequest(`Enter a price for ${it.itemCode}`);
            if (!(p.unitPrice >= 0)) throw AppError.badRequest('Prices cannot be negative');
        }
        if (input.validUntil && Number.isNaN(new Date(input.validUntil).getTime())) throw AppError.badRequest('Invalid validity date');

        const lines = items.map((it) => {
            const p = priceBy.get(it.id)!;
            return { itemCode: it.itemCode, description: it.description, unit: it.unit, quantity: it.quantity, unitPrice: p.unitPrice, totalPrice: Number(it.quantity) * p.unitPrice, deliveryDays: p.deliveryDays ?? null };
        });
        const total = Math.round(lines.reduce((a, l) => a + l.totalPrice, 0) * 100) / 100;
        const updated = await prisma.$transaction(async (tx) => {
            await tx.quotationItem.deleteMany({ where: { quotationId: quote.id } });
            return tx.quotation.update({
                where: { id: quote.id },
                data: {
                    status: 'RECEIVED', totalAmount: total,
                    validUntil: input.validUntil ? new Date(input.validUntil) : null,
                    deliveryDays: input.deliveryDays ?? null, paymentTerms: input.paymentTerms ?? null, warrantyPeriod: input.warrantyPeriod ?? null,
                    quoteDate: new Date(), items: { create: lines },
                },
                include: { items: true },
            });
        });
        AuditService.log({ userId: input.userId, action: 'RECEIVE_QUOTATION', entity: 'QUOTATION', entityId: quote.id, newValue: { total, vendor: quote.vendorName } }).catch(() => undefined);
        return updated;
    }

    static async compare(requisitionId: string, now = new Date()): Promise<Comparison> {
        const requisition = await prisma.projectRequisition.findUnique({
            where: { id: requisitionId },
            include: { items: true, quotations: { include: { items: true }, orderBy: { createdAt: 'asc' } } },
        });
        if (!requisition) throw AppError.notFound('Requisition not found');
        const received = requisition.quotations.filter((q) => ['RECEIVED', 'ACCEPTED'].includes(q.status));
        const scores = scoreQuotes(received.map((q) => ({ id: q.id, total: Number(q.totalAmount), deliveryDays: q.deliveryDays, validUntil: q.validUntil })), now);
        const lowestTotal = received.length ? Math.min(...received.filter((q) => Number(q.totalAmount) > 0).map((q) => Number(q.totalAmount))) : 0;
        const itemIndex = new Map(requisition.items.map((i) => [`${i.itemCode}|${i.description}`, i.id]));

        return {
            requisition: { id: requisition.id, prNumber: requisition.prNumber, title: requisition.title, status: requisition.status, projectId: requisition.projectId },
            items: requisition.items.map((i) => ({ id: i.id, itemCode: i.itemCode, description: i.description, unit: i.unit, quantity: Number(i.quantity), estimatedPrice: Number(i.estimatedPrice) })),
            quotes: requisition.quotations.map((q) => {
                const prices: Record<string, number | null> = Object.fromEntries(requisition.items.map((i) => [i.id, null]));
                for (const qi of q.items) {
                    const id = itemIndex.get(`${qi.itemCode}|${qi.description}`);
                    if (id) prices[id] = Number(qi.unitPrice);
                }
                const s = scores.get(q.id);
                return {
                    id: q.id, quoteNumber: q.quoteNumber, vendorId: q.vendorId, vendorName: q.vendorName, status: q.status,
                    total: Number(q.totalAmount), deliveryDays: q.deliveryDays, validUntil: q.validUntil ? q.validUntil.toISOString() : null, paymentTerms: q.paymentTerms,
                    score: s ? s.score : null, expired: s?.expired ?? false, lowest: ['RECEIVED', 'ACCEPTED'].includes(q.status) && Number(q.totalAmount) > 0 && Number(q.totalAmount) === lowestTotal,
                    complete: Object.values(prices).every((p) => p !== null), prices,
                };
            }),
            awardedQuotationId: requisition.quotations.find((q) => q.status === 'ACCEPTED')?.id ?? null,
        };
    }

    /** Accept one quotation, reject the other open ones, and raise a draft purchase order from the accepted lines. */
    static async award(quotationId: string, userId: string, reason?: string | null) {
        const quote = await prisma.quotation.findUnique({ where: { id: quotationId }, include: { items: true, requisition: { include: { items: true, quotations: true } } } });
        if (!quote) throw AppError.notFound('Quotation not found');
        if (quote.status !== 'RECEIVED') throw AppError.badRequest('Only a received quotation can be awarded');
        if (quote.requisition.quotations.some((q) => q.status === 'ACCEPTED')) throw AppError.conflict('This requisition has already been awarded');
        if (quote.validUntil && quote.validUntil.getTime() < Date.now()) throw AppError.badRequest('This quotation has expired');
        if (quote.items.length < quote.requisition.items.length) throw AppError.badRequest('This quotation does not price every requisition item');

        // Awarding anything other than the lowest valid quotation needs a recorded reason
        const comparison = await this.compare(quote.requisitionId);
        const lowest = comparison.quotes.find((q) => q.lowest && !q.expired);
        if (lowest && lowest.id !== quote.id && (!reason || reason.trim().length < 5)) {
            throw AppError.badRequest(`AWARD_REASON_REQUIRED: ${lowest.vendorName} quoted lower; give a reason to award ${quote.vendorName}`);
        }

        const claim = await prisma.quotation.updateMany({ where: { id: quote.id, status: 'RECEIVED' }, data: { status: 'ACCEPTED', acceptedById: userId, acceptedAt: new Date(), remarks: reason?.trim() || quote.remarks } });
        if (claim.count === 0) throw AppError.conflict('This quotation was already actioned');
        await prisma.quotation.updateMany({ where: { requisitionId: quote.requisitionId, id: { not: quote.id }, status: { in: ['REQUESTED', 'RECEIVED'] } }, data: { status: 'REJECTED' } });

        const reqItemBy = new Map(quote.requisition.items.map((i) => [`${i.itemCode}|${i.description}`, i]));
        const po = await ProjectPurchaseOrderService.createPurchaseOrder({
            projectId: quote.requisition.projectId,
            requisitionId: quote.requisitionId,
            vendorId: quote.vendorId,
            vendorName: quote.vendorName,
            title: `${quote.requisition.title} (awarded ${quote.quoteNumber})`,
            paymentTerms: quote.paymentTerms,
            quotationId: quote.id,
            createdById: userId,
            items: quote.items.map((qi) => ({
                requisitionItemId: reqItemBy.get(`${qi.itemCode}|${qi.description}`)?.id ?? null,
                itemCode: qi.itemCode, description: qi.description, unit: qi.unit, quantity: Number(qi.quantity), unitPrice: Number(qi.unitPrice),
            })),
        });
        AuditService.log({ userId, action: 'AWARD_QUOTATION', entity: 'QUOTATION', entityId: quote.id, newValue: { vendor: quote.vendorName, total: Number(quote.totalAmount), po: po.poNumber, reason: reason ?? null } }).catch(() => undefined);
        return { quotationId: quote.id, purchaseOrder: po };
    }
}
