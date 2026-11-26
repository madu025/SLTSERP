import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';
import { AuditLedgerService } from '@/services/inventory/audit-ledger.service';
import { StoreService } from '@/services/inventory/store.service';
import { AuditService } from '@/services/audit/audit.service';
import { canTransitionPo, computePoTotals, isPoEditable, normalizePoStatus, valueAmendment, validatePoLine, type PoStatus } from '@/lib/procurement-rules';
import { FIRST_PO_STAGE, PO_STAGE_LABEL, PO_STAGE_PERMISSION, assertRemarks, isPoStage, nextStage, previousStage, type PoApprovalAction, type PoStage } from '@/lib/po-approval-chain';
import { approvalEntryHash, firstBrokenEntry } from '@/lib/po-approval-hash';
import { userHasPermission } from '@/lib/user-permissions';

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
    /** Required when the change restarts the approval chain. */
    reason?: string | null;
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
                    // every order goes through the three approval steps, whatever its value
                    status: 'PENDING_APPROVAL',
                    approvalStage: FIRST_PO_STAGE,
                    createdById: userId,
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
            await this.appendApproval(tx, created.id, { stage: FIRST_PO_STAGE, action: 'SUBMITTED', actorId: userId, amount: totals.totalAmount, remarks: input.remarks ?? null });
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
        // An amended quantity still has to stay within what was approved, less what the request's other live orders already cover
        const reqItems = await prisma.stockRequestItem.findMany({ where: { requestId: po.stockRequestId }, select: { id: true, approvedQty: true, requestedQty: true } });
        const others = await prisma.purchaseOrderItem.groupBy({
            by: ['stockRequestItemId'],
            where: { purchaseOrder: { stockRequestId: po.stockRequestId, id: { not: po.id }, status: { not: 'CANCELLED' } } },
            _sum: { quantity: true },
        });
        const othersBy = new Map(others.map((o) => [o.stockRequestItemId, Number(o._sum.quantity ?? 0)]));
        for (const l of next) {
            const ri = reqItems.find((r) => r.id === l.stockRequestItemId);
            if (!ri) continue;
            const approved = Number(ri.approvedQty) > 0 ? Number(ri.approvedQty) : Number(ri.requestedQty);
            const room = approved - (othersBy.get(l.stockRequestItemId) ?? 0);
            if (Number(l.quantity) > room + 1e-9) throw AppError.badRequest(`Ordering ${Number(l.quantity)} but only ${Math.max(0, room)} of the approved quantity is available for this order`);
        }

        const totals = computePoTotals(next.map((l) => ({ quantity: Number(l.quantity), unitPrice: Number(l.unitPrice), taxAmount: Number(l.taxAmount) })));

        // A change of vendor or value after the order has been raised: allowed on a returned order, restarts the chain on a waiting or approved one, never on an issued one
        const valueChanged = (vendorId ?? null) !== (po.vendorId ?? null) || (input.lines ?? []).length > 0;
        let restart = false;
        let resetRemarks: string | null = null;
        if (valueChanged) {
            const mode = valueAmendment(po.status);
            if (mode === 'NOT_ALLOWED') throw AppError.badRequest('An issued order is a commitment to the vendor: cancel it and raise a new one to change the vendor or value');
            if (mode === 'RESTARTS_CHAIN') {
                resetRemarks = assertRemarks('RESET', input.reason);
                if (!resetRemarks) throw AppError.badRequest('Give a reason: changing the vendor or value sends the order back to the first approval step');
                restart = true;
            }
        }

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
                    ...(restart ? { status: 'PENDING_APPROVAL', approvalStage: FIRST_PO_STAGE, approvedById: null, approvedAt: null } : {}),
                },
                include: { items: true },
            }).then(async (row) => {
                if (restart) await this.appendApproval(tx, po.id, { stage: FIRST_PO_STAGE, action: 'RESET', actorId: input.userId, amount: totals.totalAmount, remarks: resetRemarks });
                return row;
            });
        }, { maxWait: 10_000, timeout: 30_000 });
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

    /**
     * Adds one entry to the order's append-only approval log (hash-chained, so a change to an earlier entry is detectable).
     * The unique (order, seq) key makes two writers racing for the same place fail instead of forking the chain.
     */
    private static async appendApproval(client: Omit<typeof prisma, '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'>, poId: string, e: { stage: string | null; action: PoApprovalAction; actorId: string; amount: number; remarks: string | null }) {
        const last = await client.purchaseOrderApproval.findFirst({ where: { purchaseOrderId: poId }, orderBy: { seq: 'desc' }, select: { seq: true, hash: true } });
        const seq = (last?.seq ?? 0) + 1;
        const createdAt = new Date();
        const amount = String(e.amount);
        const hash = approvalEntryHash(last?.hash ?? null, { purchaseOrderId: poId, seq, stage: e.stage, action: e.action, actorId: e.actorId, amount, remarks: e.remarks, createdAt });
        try {
            return await client.purchaseOrderApproval.create({ data: { purchaseOrderId: poId, seq, stage: e.stage, action: e.action, actorId: e.actorId, amount, remarks: e.remarks, previousHash: last?.hash ?? null, hash, createdAt } });
        } catch (error) {
            if ((error as { code?: string }).code === 'P2002') throw AppError.conflict('This order was just actioned by someone else; reload and try again');
            throw error;
        }
    }

    /** The step the order waits at; orders from before the chain existed enter at step 1. */
    private static currentStage(po: { approvalStage: string | null }): PoStage {
        return isPoStage(po.approvalStage) ? po.approvalStage : FIRST_PO_STAGE;
    }

    /** Whoever acts on a step must hold that step's capability. */
    private static async assertHoldsStage(userId: string, stage: PoStage, poId: string) {
        if (await userHasPermission(userId, PO_STAGE_PERMISSION[stage])) return;
        AuditService.log({ userId, action: 'PO_STAGE_NOT_PERMITTED', entity: 'PURCHASE_ORDER', entityId: poId, newValue: { stage } }).catch(() => undefined);
        throw AppError.forbidden(`PO_STAGE_NOT_PERMITTED: this order is waiting at ${PO_STAGE_LABEL[stage]}; you do not hold that approval step`);
    }

    /**
     * One step of the chain. The person who raised the order can never approve it, and nobody approves two steps of the same order,
     * so three different people always sign. The approval and its log entry are written together.
     */
    static async approveStorePo(poId: string, userId: string, remarks?: string | null) {
        const po = await this.loadEditable(poId);
        await this.assertStoreAccess(userId, po.stockRequest.fromStoreId, po.stockRequest.toStoreId);
        if (normalizePoStatus(po.status) !== 'PENDING_APPROVAL') throw AppError.badRequest('Only an order that is waiting for approval can be approved');
        const stage = this.currentStage(po);
        await this.assertHoldsStage(userId, stage, poId);
        if (po.createdById && po.createdById === userId) {
            AuditService.log({ userId, action: 'SOD_VIOLATION_BLOCKED', entity: 'PURCHASE_ORDER', entityId: poId, newValue: { reason: 'creator tried to approve own purchase order', stage } }).catch(() => undefined);
            throw AppError.badRequest('SEGREGATION_OF_DUTIES_VIOLATION: the person who raised a purchase order cannot approve it');
        }
        // Within the current pass of the chain (since it was last submitted or restarted) one person signs one step only.
        // Approving the same step again after a return is allowed: the order came back to that step.
        const passStart = await prisma.purchaseOrderApproval.findFirst({ where: { purchaseOrderId: poId, action: { in: ['SUBMITTED', 'RESET'] } }, orderBy: { seq: 'desc' }, select: { seq: true } });
        const otherStep = await prisma.purchaseOrderApproval.count({ where: { purchaseOrderId: poId, actorId: userId, action: 'APPROVED', seq: { gt: passStart?.seq ?? 0 }, stage: { not: stage } } });
        if (otherStep > 0) throw AppError.badRequest('SEGREGATION_OF_DUTIES_VIOLATION: you have already approved another step of this order; this step needs a different person');
        const next = nextStage(stage);
        const amount = Number(po.totalAmount);
        const note = assertRemarks('APPROVED', remarks);

        await prisma.$transaction(async (tx) => {
            const claim = await tx.purchaseOrder.updateMany({
                where: { id: poId, status: 'PENDING_APPROVAL', approvalStage: po.approvalStage },
                data: next ? { approvalStage: next } : { status: 'APPROVED', approvalStage: null, approvedById: userId, approvedAt: new Date() },
            });
            if (claim.count === 0) throw AppError.conflict('This order was already actioned');
            await this.appendApproval(tx, poId, { stage, action: 'APPROVED', actorId: userId, amount, remarks: note });
        }, { maxWait: 10_000, timeout: 30_000 });
        AuditService.log({ userId, action: 'APPROVE_STORE_PO', entity: 'PURCHASE_ORDER', entityId: poId, oldValue: { status: 'PENDING_APPROVAL', stage }, newValue: { status: next ? 'PENDING_APPROVAL' : 'APPROVED', nextStage: next, total: amount, remarks: note } }).catch(() => undefined);
        return prisma.purchaseOrder.findUniqueOrThrow({ where: { id: poId }, include: { items: true } });
    }

    /** A return, with remarks: the order goes one step back, and from step 1 back to the person who raised it. */
    static async returnStorePo(poId: string, userId: string, remarks: string) {
        const note = assertRemarks('RETURNED', remarks);
        if (!note) throw AppError.badRequest('Remarks are required when an order is returned');
        const po = await this.loadEditable(poId);
        await this.assertStoreAccess(userId, po.stockRequest.fromStoreId, po.stockRequest.toStoreId);
        if (normalizePoStatus(po.status) !== 'PENDING_APPROVAL') throw AppError.badRequest('Only an order that is waiting for approval can be returned');
        const stage = this.currentStage(po);
        await this.assertHoldsStage(userId, stage, poId);
        const back = previousStage(stage);
        const amount = Number(po.totalAmount);
        await prisma.$transaction(async (tx) => {
            const claim = await tx.purchaseOrder.updateMany({
                where: { id: poId, status: 'PENDING_APPROVAL', approvalStage: po.approvalStage },
                data: back ? { approvalStage: back } : { status: 'RETURNED', approvalStage: null },
            });
            if (claim.count === 0) throw AppError.conflict('This order was already actioned');
            await this.appendApproval(tx, poId, { stage, action: 'RETURNED', actorId: userId, amount, remarks: note });
        }, { maxWait: 10_000, timeout: 30_000 });
        AuditService.log({ userId, action: 'RETURN_STORE_PO', entity: 'PURCHASE_ORDER', entityId: poId, oldValue: { status: 'PENDING_APPROVAL', stage }, newValue: { status: back ? 'PENDING_APPROVAL' : 'RETURNED', stage: back, remarks: note } }).catch(() => undefined);
        return prisma.purchaseOrder.findUniqueOrThrow({ where: { id: poId }, include: { items: true } });
    }

    /** The returned order, amended, goes into the chain again at step 1. */
    static async resubmitStorePo(poId: string, userId: string, remarks?: string | null) {
        const po = await this.loadEditable(poId);
        await this.assertStoreAccess(userId, po.stockRequest.fromStoreId, po.stockRequest.toStoreId);
        if (normalizePoStatus(po.status) !== 'RETURNED') throw AppError.badRequest('Only a returned order can be sent for approval again');
        const amount = Number(po.totalAmount);
        await prisma.$transaction(async (tx) => {
            const claim = await tx.purchaseOrder.updateMany({ where: { id: poId, status: 'RETURNED' }, data: { status: 'PENDING_APPROVAL', approvalStage: FIRST_PO_STAGE } });
            if (claim.count === 0) throw AppError.conflict('This order was already actioned');
            await this.appendApproval(tx, poId, { stage: FIRST_PO_STAGE, action: 'SUBMITTED', actorId: userId, amount, remarks: assertRemarks('SUBMITTED', remarks) });
        }, { maxWait: 10_000, timeout: 30_000 });
        AuditService.log({ userId, action: 'RESUBMIT_STORE_PO', entity: 'PURCHASE_ORDER', entityId: poId, oldValue: { status: 'RETURNED' }, newValue: { status: 'PENDING_APPROVAL', stage: FIRST_PO_STAGE } }).catch(() => undefined);
        return prisma.purchaseOrder.findUniqueOrThrow({ where: { id: poId }, include: { items: true } });
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
        const { po, updated } = await this.move(poId, userId, 'CANCELLED', { cancelledAt: new Date(), cancelledById: userId, cancellationReason: reason.trim(), approvalStage: null }, 'CANCEL_STORE_PO', reason.trim());
        await this.appendApproval(prisma, poId, { stage: null, action: 'CANCELLED', actorId: userId, amount: Number(existing.totalAmount), remarks: reason.trim() });
        const others = await prisma.purchaseOrder.count({ where: { stockRequestId: po.stockRequestId, id: { not: poId }, status: { not: 'CANCELLED' } } });
        if (others === 0) await prisma.stockRequest.update({ where: { id: po.stockRequestId }, data: { procurementStatus: 'PENDING' } });
        return updated;
    }

    static async closeStorePo(poId: string, userId: string) {
        const { updated } = await this.move(poId, userId, 'CLOSED', { closedAt: new Date() }, 'CLOSE_STORE_PO');
        return updated;
    }

    /**
     * Everything an auditor needs about one order in one place: the order, who raised it, every approval step with its remarks,
     * whether the hash chain of that log is intact, the goods receipts, the supplier invoices (and who approved them), and the audit trail.
     */
    static async dossier(poId: string, userId: string) {
        const po = await prisma.purchaseOrder.findUnique({
            where: { id: poId },
            include: {
                items: { include: { stockRequestItem: { include: { item: { select: { code: true, name: true, unit: true } } } } } },
                stockRequest: { select: { id: true, requestNr: true, fromStoreId: true, toStoreId: true } },
                approvals: { orderBy: { seq: 'asc' } },
                grns: { select: { id: true, grnNumber: true, createdAt: true, receivedById: true }, orderBy: { createdAt: 'asc' } },
                supplierInvoices: { select: { id: true, invoiceNumber: true, totalAmount: true, status: true, matchStatus: true, createdById: true, financeApprovedById: true, financeApprovedAt: true, approvedById: true, approvedAt: true, overrideReason: true, rejectionReason: true, createdAt: true }, orderBy: { createdAt: 'asc' } },
            },
        });
        if (!po) throw AppError.notFound('Purchase order not found');
        await this.assertStoreAccess(userId, po.stockRequest.fromStoreId, po.stockRequest.toStoreId);

        const ids = new Set<string>();
        for (const id of [po.createdById, po.approvedById, po.cancelledById, ...po.approvals.map((a) => a.actorId), ...po.grns.map((g) => g.receivedById), ...po.supplierInvoices.flatMap((i) => [i.createdById, i.financeApprovedById, i.approvedById])]) if (id) ids.add(id);
        const people = await prisma.user.findMany({ where: { id: { in: [...ids] } }, select: { id: true, name: true, username: true } });
        const who = new Map(people.map((p) => [p.id, p.name || p.username]));
        const name = (id: string | null | undefined) => (id ? who.get(id) ?? 'Unknown user' : null);

        const trail = await prisma.auditLog.findMany({
            where: { entity: { in: ['PURCHASE_ORDER', 'SUPPLIER_INVOICE'] }, entityId: { in: [poId, ...po.supplierInvoices.map((i) => i.id)] } },
            orderBy: { createdAt: 'asc' },
            take: 500,
            select: { id: true, action: true, entity: true, entityId: true, userId: true, createdAt: true, newValue: true },
        });
        const broken = firstBrokenEntry(po.approvals.map((a) => ({ ...a, createdAt: a.createdAt })));
        return {
            po: {
                id: po.id, poNumber: po.poNumber, status: normalizePoStatus(po.status), approvalStage: isPoStage(po.approvalStage) ? po.approvalStage : null,
                vendor: po.vendor, currency: po.currency, subtotal: Number(po.subtotal), taxAmount: Number(po.taxAmount), totalAmount: Number(po.totalAmount),
                orderDate: po.orderDate, expectedDelivery: po.expectedDelivery, requestNr: po.stockRequest.requestNr,
                createdBy: name(po.createdById), approvedBy: name(po.approvedById), approvedAt: po.approvedAt,
                cancelledBy: name(po.cancelledById), cancelledAt: po.cancelledAt, cancellationReason: po.cancellationReason,
                lines: po.items.map((l) => ({ code: l.stockRequestItem.item?.code ?? null, name: l.stockRequestItem.item?.name ?? null, unit: l.stockRequestItem.item?.unit ?? null, quantity: Number(l.quantity), receivedQty: Number(l.receivedQty), unitPrice: Number(l.unitPrice), taxAmount: Number(l.taxAmount), totalAmount: Number(l.totalAmount) })),
            },
            approvals: po.approvals.map((a) => ({ seq: a.seq, stage: a.stage, stageLabel: isPoStage(a.stage) ? PO_STAGE_LABEL[a.stage] : null, action: a.action, actor: name(a.actorId), amount: Number(a.amount), remarks: a.remarks, at: a.createdAt, hash: a.hash })),
            chain: { entries: po.approvals.length, intact: broken === null, firstBrokenSeq: broken },
            receipts: po.grns.map((g) => ({ grnNumber: g.grnNumber, at: g.createdAt, receivedBy: name(g.receivedById) })),
            invoices: po.supplierInvoices.map((i) => ({ id: i.id, invoiceNumber: i.invoiceNumber, total: Number(i.totalAmount), status: i.status, match: i.matchStatus, enteredBy: name(i.createdById), financeApprovedBy: name(i.financeApprovedById), financeApprovedAt: i.financeApprovedAt, approvedBy: name(i.approvedById), approvedAt: i.approvedAt, overrideReason: i.overrideReason, rejectionReason: i.rejectionReason })),
            auditTrail: trail.map((t) => ({ at: t.createdAt, action: t.action, entity: t.entity, by: name(t.userId), detail: t.newValue })),
        };
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
