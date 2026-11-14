import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';
import { AuditLedgerService } from '@/services/inventory/audit-ledger.service';
import { StoreService } from '@/services/inventory/store.service';
import { AuditService } from '@/services/audit/audit.service';
import { canTransitionPo, computePoTotals, isPoEditable, normalizePoStatus, validatePoLine, type PoStatus } from '@/lib/procurement-rules';

export interface CreateStorePoInput {
    requestId: string;
    userId: string;
    vendorId?: string | null;
    /** Free-text vendor, only accepted when no vendor record is chosen. */
    vendorName?: string | null;
    expectedDelivery?: string | null;
    remarks?: string | null;
    currency?: string | null;
    lines: { requestItemId: string; quantity: number; unitPrice: number; taxAmount?: number }[];
}

export interface AmendStorePoInput {
    poId: string;
    userId: string;
    expectedDelivery?: string | null;
    remarks?: string | null;
    vendorId?: string | null;
    lines?: { poItemId: string; quantity?: number; unitPrice?: number; taxAmount?: number }[];
}

const CLOSED_REQUEST_STATUSES = ['REJECTED', 'CANCELLED', 'COMPLETED'];

/**
 * Store purchase orders: creation with server-side validation and totals, amend, issue, cancel and close.
 * The order's own status carries the lifecycle; the stock request's procurement status is kept in step for the existing screens.
 */
export class PurchaseOrderService {
    private static async assertStoreAccess(userId: string, fromStoreId: string | null, toStoreId: string | null) {
        const ids = [fromStoreId, toStoreId].filter(Boolean) as string[];
        if (ids.length === 0) return;
        const accessible = await StoreService.getAccessibleStores(userId);
        if (!ids.some((id) => accessible.some((s) => s.id === id))) {
            throw AppError.forbidden('STORE_SCOPE_VIOLATION: this stock request is outside your store scope');
        }
    }

    static async createStorePo(input: CreateStorePoInput) {
        const { requestId, userId, lines } = input;
        if (!lines || lines.length === 0) throw AppError.badRequest('Select at least one item for the purchase order');

        const request = await prisma.stockRequest.findUnique({
            where: { id: requestId },
            include: { items: true, purchaseOrders: { include: { items: true } } },
        });
        if (!request) throw AppError.notFound('Stock request not found');
        if (CLOSED_REQUEST_STATUSES.includes(request.status)) throw AppError.badRequest(`A purchase order cannot be raised for a ${request.status.toLowerCase()} request`);
        await this.assertStoreAccess(userId, request.fromStoreId, request.toStoreId);

        // Vendor: a chosen vendor record wins; otherwise a typed name is accepted but stays unlinked
        let vendorId: string | null = null;
        let vendorName = (input.vendorName ?? '').trim();
        if (input.vendorId) {
            const vendor = await prisma.vendor.findUnique({ where: { id: input.vendorId }, select: { id: true, name: true, status: true } });
            if (!vendor) throw AppError.badRequest('The selected vendor does not exist');
            if (vendor.status && vendor.status.toUpperCase() !== 'ACTIVE') throw AppError.badRequest(`Vendor ${vendor.name} is not active`);
            vendorId = vendor.id;
            vendorName = vendor.name;
        }
        if (!vendorName) throw AppError.badRequest('Choose a vendor');

        // Lines: each must belong to this request, be valid, and stay within what was approved less what other live POs already cover
        const byRequestItem = new Map(request.items.map((i) => [i.id, i]));
        const alreadyOrdered = new Map<string, number>();
        for (const po of request.purchaseOrders) {
            if (normalizePoStatus(po.status) === 'CANCELLED') continue;
            for (const l of po.items) alreadyOrdered.set(l.stockRequestItemId, (alreadyOrdered.get(l.stockRequestItemId) ?? 0) + Number(l.quantity));
        }
        const seen = new Set<string>();
        for (const l of lines) {
            const reqItem = byRequestItem.get(l.requestItemId);
            if (!reqItem) throw AppError.badRequest('An item does not belong to this stock request');
            if (seen.has(l.requestItemId)) throw AppError.badRequest('The same item is listed twice');
            seen.add(l.requestItemId);
            const err = validatePoLine({ quantity: l.quantity, unitPrice: l.unitPrice, taxAmount: l.taxAmount });
            if (err) throw AppError.badRequest(err);
            const approved = Number(reqItem.approvedQty) > 0 ? Number(reqItem.approvedQty) : Number(reqItem.requestedQty);
            const open = approved - (alreadyOrdered.get(l.requestItemId) ?? 0);
            if (l.quantity > open + 1e-9) throw AppError.badRequest(`Ordering ${l.quantity} but only ${Math.max(0, open)} of the approved quantity is not yet on a purchase order`);
        }

        const totals = computePoTotals(lines.map((l) => ({ quantity: l.quantity, unitPrice: l.unitPrice, taxAmount: l.taxAmount })));

        const po = await prisma.$transaction(async (tx) => {
            const poNumber = await AuditLedgerService.getNextDocumentNumber('SPO', tx);
            const created = await tx.purchaseOrder.create({
                data: {
                    poNumber,
                    vendor: vendorName,
                    vendorId,
                    expectedDelivery: input.expectedDelivery ? new Date(input.expectedDelivery) : undefined,
                    stockRequestId: requestId,
                    status: 'APPROVED',
                    currency: (input.currency || 'LKR').toUpperCase().slice(0, 3),
                    subtotal: totals.subtotal,
                    taxAmount: totals.taxAmount,
                    totalAmount: totals.totalAmount,
                    items: {
                        create: lines.map((l, i) => ({
                            stockRequestItemId: l.requestItemId,
                            quantity: l.quantity,
                            unitPrice: l.unitPrice,
                            taxAmount: l.taxAmount ?? 0,
                            totalAmount: totals.lineTotals[i],
                        })),
                    },
                },
                include: { items: true },
            });
            await tx.stockRequest.update({
                where: { id: requestId },
                data: { procurementStatus: 'PO_CREATED', ...(input.remarks ? { remarks: input.remarks } : {}) },
            });
            return created;
        });

        AuditService.log({ userId, action: 'CREATE_STORE_PO', entity: 'PURCHASE_ORDER', entityId: po.id, newValue: { poNumber: po.poNumber, vendor: vendorName, vendorId, total: totals.totalAmount, lines: lines.length } }).catch(() => undefined);
        return po;
    }

    private static async loadEditable(poId: string) {
        const po = await prisma.purchaseOrder.findUnique({ where: { id: poId }, include: { items: true, stockRequest: { select: { id: true, fromStoreId: true, toStoreId: true } } } });
        if (!po) throw AppError.notFound('Purchase order not found');
        return po;
    }

    static async amendStorePo(input: AmendStorePoInput) {
        const po = await this.loadEditable(input.poId);
        await this.assertStoreAccess(input.userId, po.stockRequest.fromStoreId, po.stockRequest.toStoreId);
        const anyReceived = po.items.some((l) => Number(l.receivedQty) > 0);
        if (!isPoEditable(po.status, anyReceived)) throw AppError.badRequest(anyReceived ? 'Goods have already been received against this order, so it can no longer be amended' : `A ${normalizePoStatus(po.status).toLowerCase()} order cannot be amended`);

        let vendorId = po.vendorId;
        let vendorName = po.vendor;
        if (input.vendorId && input.vendorId !== po.vendorId) {
            const vendor = await prisma.vendor.findUnique({ where: { id: input.vendorId }, select: { id: true, name: true, status: true } });
            if (!vendor) throw AppError.badRequest('The selected vendor does not exist');
            vendorId = vendor.id;
            vendorName = vendor.name;
        }

        const next = po.items.map((l) => ({ ...l }));
        for (const edit of input.lines ?? []) {
            const target = next.find((l) => l.id === edit.poItemId);
            if (!target) throw AppError.badRequest('A line does not belong to this purchase order');
            if (edit.quantity !== undefined) target.quantity = edit.quantity as never;
            if (edit.unitPrice !== undefined) target.unitPrice = edit.unitPrice as never;
            if (edit.taxAmount !== undefined) target.taxAmount = edit.taxAmount as never;
            const err = validatePoLine({ quantity: Number(target.quantity), unitPrice: Number(target.unitPrice), taxAmount: Number(target.taxAmount) });
            if (err) throw AppError.badRequest(err);
        }
        const totals = computePoTotals(next.map((l) => ({ quantity: Number(l.quantity), unitPrice: Number(l.unitPrice), taxAmount: Number(l.taxAmount) })));

        const before = { vendor: po.vendor, expectedDelivery: po.expectedDelivery, total: Number(po.totalAmount) };
        const updated = await prisma.$transaction(async (tx) => {
            for (let i = 0; i < next.length; i++) {
                const l = next[i];
                await tx.purchaseOrderItem.update({ where: { id: l.id }, data: { quantity: l.quantity, unitPrice: l.unitPrice, taxAmount: l.taxAmount, totalAmount: totals.lineTotals[i] } });
            }
            return tx.purchaseOrder.update({
                where: { id: po.id },
                data: {
                    vendor: vendorName, vendorId,
                    ...(input.expectedDelivery !== undefined ? { expectedDelivery: input.expectedDelivery ? new Date(input.expectedDelivery) : null } : {}),
                    subtotal: totals.subtotal, taxAmount: totals.taxAmount, totalAmount: totals.totalAmount,
                },
                include: { items: true },
            });
        });
        AuditService.log({ userId: input.userId, action: 'AMEND_STORE_PO', entity: 'PURCHASE_ORDER', entityId: po.id, oldValue: before, newValue: { vendor: vendorName, expectedDelivery: updated.expectedDelivery, total: totals.totalAmount } }).catch(() => undefined);
        return updated;
    }

    /** Moves the order to a new status, but only along the allowed lifecycle. */
    private static async move(poId: string, userId: string, to: PoStatus, data: Record<string, unknown>, action: string, reason?: string) {
        const po = await this.loadEditable(poId);
        await this.assertStoreAccess(userId, po.stockRequest.fromStoreId, po.stockRequest.toStoreId);
        if (!canTransitionPo(po.status, to)) throw AppError.badRequest(`A ${normalizePoStatus(po.status).toLowerCase().replace('_', ' ')} order cannot be ${to.toLowerCase().replace('_', ' ')}`);
        const updated = await prisma.purchaseOrder.update({ where: { id: poId }, data: { status: to, ...data } });
        AuditService.log({ userId, action, entity: 'PURCHASE_ORDER', entityId: poId, oldValue: { status: normalizePoStatus(po.status) }, newValue: { status: to, ...(reason ? { reason } : {}) } }).catch(() => undefined);
        return { po, updated };
    }

    static async issueStorePo(poId: string, userId: string) {
        const { po, updated } = await this.move(poId, userId, 'ISSUED', {}, 'ISSUE_STORE_PO');
        await prisma.stockRequest.update({ where: { id: po.stockRequestId }, data: { procurementStatus: 'PO_SENT' } });
        return updated;
    }

    /** Cancelling is only possible before anything is received; the request goes back to "awaiting PO" when no other live PO covers it. */
    static async cancelStorePo(poId: string, userId: string, reason: string) {
        if (!reason || reason.trim().length < 3) throw AppError.badRequest('A cancellation reason is required');
        const existing = await this.loadEditable(poId);
        if (existing.items.some((l) => Number(l.receivedQty) > 0)) throw AppError.badRequest('Goods have already been received against this order, so it cannot be cancelled');
        const { po, updated } = await this.move(poId, userId, 'CANCELLED', { cancelledAt: new Date(), cancelledById: userId, cancellationReason: reason.trim() }, 'CANCEL_STORE_PO', reason.trim());
        const others = await prisma.purchaseOrder.count({ where: { stockRequestId: po.stockRequestId, id: { not: poId }, status: { not: 'CANCELLED' } } });
        if (others === 0) await prisma.stockRequest.update({ where: { id: po.stockRequestId }, data: { procurementStatus: 'PENDING' } });
        return updated;
    }

    static async closeStorePo(poId: string, userId: string) {
        const { updated } = await this.move(poId, userId, 'CLOSED', { closedAt: new Date() }, 'CLOSE_STORE_PO');
        return updated;
    }

    static async listStorePos(userId: string, filter: { status?: string; vendorId?: string } = {}) {
        const stores = await StoreService.getAccessibleStores(userId);
        const ids = stores.map((s) => s.id);
        return prisma.purchaseOrder.findMany({
            where: {
                ...(filter.status ? { status: filter.status } : {}),
                ...(filter.vendorId ? { vendorId: filter.vendorId } : {}),
                stockRequest: { OR: [{ fromStoreId: { in: ids } }, { toStoreId: { in: ids } }] },
            },
            orderBy: { createdAt: 'desc' },
            take: 300,
            include: { items: { include: { stockRequestItem: { include: { item: { select: { code: true, name: true } } } } } }, stockRequest: { select: { requestNr: true } } },
        });
    }
}
