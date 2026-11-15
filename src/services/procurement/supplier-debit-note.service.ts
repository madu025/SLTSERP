import { AuditLedgerService } from '@/services/inventory/audit-ledger.service';
import { debitNoteQty } from '@/lib/procurement-rules';
import type { TransactionClient } from '@/types/inventory/inventory-service.types';

export interface DebitNoteBasis {
    vendorId: string;
    supplierInvoiceId: string | null;
    /** Goods value to take off the vendor payable (order price x quantity) */
    amount: number;
    /** Input VAT that goes back with the goods */
    tax: number;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * A supplier return of goods that have already been invoiced is a debit note: it reduces what we owe the vendor.
 * Goods that were received but not yet invoiced just reduce the GR/IR accrual (no debit note, nothing to net off).
 *
 * The invoiced quantity is compared with what remains after the return: when we hold fewer goods than we were billed for,
 * the shortfall is the debit-noted quantity. Earlier returns of the same goods are taken into account so a second return
 * never debit-notes the same invoice quantity twice.
 */
export class SupplierDebitNoteService {
    static async basisForReturn(tx: TransactionClient, mrn: { id: string; grnId: string | null; items: { itemId: string; quantity: unknown }[] }): Promise<DebitNoteBasis | null> {
        if (!mrn.grnId) return null;
        const grn = await tx.gRN.findUnique({
            where: { id: mrn.grnId },
            select: { purchaseOrder: { select: { id: true, vendorId: true, items: { select: { id: true, unitPrice: true, receivedQty: true, stockRequestItem: { select: { itemId: true } } } } } } },
        });
        const po = grn?.purchaseOrder;
        if (!po || !po.vendorId) return null;

        let amount = 0;
        let tax = 0;
        let supplierInvoiceId: string | null = null;
        for (const item of mrn.items) {
            const line = po.items.find((l) => l.stockRequestItem.itemId === item.itemId);
            if (!line) continue;
            const billedRows = await tx.supplierInvoiceItem.findMany({
                where: { poItemId: line.id, invoice: { status: { in: ['APPROVED', 'PARTIALLY_PAID', 'PAID'] } } },
                select: { quantity: true, taxAmount: true, invoiceId: true },
            });
            const billed = billedRows.reduce((a, r) => a + Number(r.quantity), 0);
            if (billed <= 0) continue;
            const prior = await tx.mRNItem.aggregate({
                where: { itemId: item.itemId, mrn: { grnId: mrn.grnId, status: 'COMPLETED', id: { not: mrn.id } } },
                _sum: { quantity: true },
            });
            const dnQty = debitNoteQty(billed, Number(line.receivedQty), Number(prior._sum.quantity ?? 0), Number(item.quantity));
            if (dnQty <= 0) continue;
            const billedTax = billedRows.reduce((a, r) => a + Number(r.taxAmount), 0);
            amount += dnQty * Number(line.unitPrice);
            tax += billedTax * (dnQty / billed);
            supplierInvoiceId ??= billedRows[0].invoiceId;
        }
        return amount > 0 ? { vendorId: po.vendorId, supplierInvoiceId, amount: round2(amount), tax: round2(tax) } : null;
    }

    static async record(tx: TransactionClient, basis: DebitNoteBasis, mrnId: string, userId: string | null, journalEntryId: string | null, reason?: string | null) {
        const noteNumber = await AuditLedgerService.getNextDocumentNumber('SDN', tx);
        return tx.supplierDebitNote.create({
            data: { noteNumber, vendorId: basis.vendorId, supplierInvoiceId: basis.supplierInvoiceId, mrnId, amount: basis.amount, taxAmount: basis.tax, reason: reason ?? 'Goods returned to the supplier after invoicing', createdById: userId, journalEntryId },
        });
    }
}

