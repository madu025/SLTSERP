import { AppError } from '@/lib/error';
import { prisma } from '@/lib/prisma';
import { AuditLedgerService } from '@/services/inventory/audit-ledger.service';
import { TransactionClient } from '@/types/inventory/inventory-service.types';
import { userHasPermission } from '@/lib/user-permissions';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';

interface GRNItemInput {
    poItemId: string;
    itemCode: string;
    description: string;
    unit?: string;
    quantityOrdered: number;
    quantityReceived: number;
    quantityAccepted?: number;
    quantityRejected?: number;
    rejectionReason?: string | null;
    unitPrice: number;
    batchNumber?: string | null;
    serialNumbers?: string[];
    notes?: string | null;
}

interface CreateGoodsReceiptInput {
    poId: string;
    projectId: string;
    receivedById: string;
    receivedDate?: string | Date;
    deliveryNoteRef?: string | null;
    invoiceRef?: string | null;
    remarks?: string | null;
    storeId?: string | null;
    items: GRNItemInput[];
}

export class ProjectGoodsReceiptService {
    /**
     * Get list of goods receipts
     */
    static async getGoodsReceipts(projectId?: string | null, poId?: string | null) {
        const where: Record<string, unknown> = {};
        if (projectId) where.projectId = projectId;
        if (poId) where.poId = poId;

        const goodsReceipts = await prisma.projectGoodsReceipt.findMany({
            where,
            include: {
                items: true,
                purchaseOrder: {
                    select: { poNumber: true, title: true, vendorName: true }
                }
            },
            orderBy: { receivedDate: 'desc' },
        });

        return goodsReceipts;
    }

    /**
     * Create a new goods receipt in a transaction, updating PO item tracking and PO statuses
     */
    static async createGoodsReceipt(data: CreateGoodsReceiptInput) {
        const {
            poId,
            projectId,
            receivedById,
            receivedDate,
            deliveryNoteRef,
            invoiceRef,
            remarks,
            storeId,
            items,
        } = data;

        // Verify PO exists and is open for receiving
        const po = await prisma.projectPurchaseOrder.findUnique({
            where: { id: poId },
            include: { items: true },
        });
        if (!po) {
            throw AppError.badRequest('PURCHASE_ORDER_NOT_FOUND');
        }
        if (!['APPROVED', 'ISSUED', 'PARTIALLY_RECEIVED'].includes(po.status)) {
            throw AppError.badRequest(`PURCHASE_ORDER_NOT_OPEN: ${po.poNumber} is ${po.status} and cannot receive goods`);
        }
        if (po.projectId !== projectId) {
            throw AppError.badRequest('PURCHASE_ORDER_PROJECT_MISMATCH');
        }

        // The PO is the authority on item, ordered quantity and price: a client cannot receive an item that is not on the order,
        // receive more than the balance, or change the price. Accepted + rejected must add up to what was received.
        const poItemById = new Map(po.items.map((pi) => [pi.id, pi]));
        const acceptedByLine = new Map<string, number>();
        const lines = items.map((i) => {
            const pi = poItemById.get(i.poItemId);
            if (!pi) throw AppError.badRequest('ITEM_NOT_ON_PURCHASE_ORDER: a receipt line does not belong to this purchase order');
            const received = Number(i.quantityReceived || 0);
            const rejected = Number(i.quantityRejected || 0);
            const accepted = i.quantityAccepted !== undefined && i.quantityAccepted !== null ? Number(i.quantityAccepted) : received - rejected;
            if (!(received > 0)) throw AppError.badRequest('QUANTITY_RECEIVED_REQUIRED: enter a quantity greater than zero');
            if (accepted < 0 || rejected < 0) throw AppError.badRequest('INVALID_QUANTITY: quantities cannot be negative');
            if (Math.abs(accepted + rejected - received) > 1e-6) throw AppError.badRequest('QUANTITY_MISMATCH: accepted plus rejected must equal the quantity received');
            acceptedByLine.set(i.poItemId, (acceptedByLine.get(i.poItemId) ?? 0) + accepted);
            return {
                ...i,
                itemCode: pi.itemCode, description: pi.description, unit: pi.unit,
                quantityOrdered: Number(pi.quantity), unitPrice: Number(pi.unitPrice),
                quantityReceived: received, quantityAccepted: accepted, quantityRejected: rejected,
            };
        });
        for (const [lineId, accepted] of acceptedByLine) {
            const pi = poItemById.get(lineId)!;
            const balance = Number(pi.quantity) - Number(pi.receivedQty);
            if (accepted > balance + 1e-9) {
                throw AppError.badRequest(`GR_QUANTITY_EXCEEDS_PO: ${pi.itemCode} has only ${Math.max(0, Number(balance.toFixed(4)))} left to receive on ${po.poNumber}`);
            }
        }

        // Auto-generate GRN number
        const lastGRN = await prisma.projectGoodsReceipt.findFirst({
            orderBy: { grnNumber: 'desc' },
            select: { grnNumber: true },
        });

        let nextGRNNumber: string;
        if (lastGRN && lastGRN.grnNumber) {
            const lastNum = parseInt(lastGRN.grnNumber.replace('GRN-', ''), 10);
            const nextNum = isNaN(lastNum) ? 1 : lastNum + 1;
            nextGRNNumber = 'GRN-' + String(nextNum).padStart(5, '0');
        } else {
            nextGRNNumber = 'GRN-00001';
        }

        // Use transaction to create GR + update PO item quantities
        const goodsReceipt = await prisma.$transaction(async (tx) => {
            const newGR = await tx.projectGoodsReceipt.create({
                data: {
                    grnNumber: nextGRNNumber,
                    poId,
                    projectId,
                    receivedById,
                    receivedDate: receivedDate ? new Date(receivedDate) : new Date(),
                    deliveryNoteRef: deliveryNoteRef || null,
                    invoiceRef: invoiceRef || null,
                    remarks: remarks || null,
                    storeId: storeId || null,
                    items: {
                        create: lines.map((item) => ({
                            poItemId: item.poItemId,
                            itemCode: item.itemCode,
                            description: item.description,
                            unit: item.unit || 'NOS',
                            quantityOrdered: item.quantityOrdered || 0,
                            quantityReceived: item.quantityReceived || 0,
                            quantityAccepted: item.quantityAccepted,
                            quantityRejected: item.quantityRejected || 0,
                            rejectionReason: item.rejectionReason || null,
                            unitPrice: item.unitPrice || 0,
                            totalPrice: (item.unitPrice || 0) * (item.quantityAccepted || 0),
                            batchNumber: item.batchNumber || null,
                            serialNumbers: item.serialNumbers || [],
                            notes: item.notes || null,
                        })),
                    },
                },
                include: { items: true },
            });

            // Update PO item received/balance quantities
            for (const item of lines) {
                if (item.poItemId) {
                    const poItem = await tx.projectPurchaseOrderItem.findUnique({
                        where: { id: item.poItemId }
                    });
                    if (poItem) {
                        const acceptedQty = Number(item.quantityAccepted ?? 0);
                        const newReceived = Number(poItem.receivedQty || 0) + acceptedQty;
                        const newBalance = Number(poItem.balanceQty || 0) - acceptedQty;
                        await tx.projectPurchaseOrderItem.update({
                            where: { id: item.poItemId },
                            data: {
                                receivedQty: newReceived,
                                balanceQty: Math.max(0, newBalance),
                            },
                        });
                    }
                }
            }

            // Update PO status if all items fully received
            const poItems = await tx.projectPurchaseOrderItem.findMany({
                where: { poId }
            });
            const allReceived = poItems.every(pi => Number(pi.balanceQty || 0) <= 0);
            if (allReceived) {
                await tx.projectPurchaseOrder.update({
                    where: { id: poId },
                    data: { status: 'FULLY_RECEIVED' },
                });
            } else {
                const anyReceived = poItems.some(pi => Number(pi.receivedQty || 0) > 0);
                if (anyReceived) {
                    await tx.projectPurchaseOrder.update({
                        where: { id: poId },
                        data: { status: 'PARTIALLY_RECEIVED' },
                    });
                }
            }

            return newGR;
        });

        return goodsReceipt;
    }

    /**
     * Approve or reject goods receipt
     */
    static async updateGoodsReceiptStatus(id: string, status: string, approvedById?: string | null) {
        const validStatuses = ['PENDING', 'APPROVED', 'REJECTED'];
        if (!validStatuses.includes(status)) {
            throw AppError.badRequest('INVALID_STATUS');
        }

        const updateData: Record<string, unknown> = { status };
        if (status === 'APPROVED' && approvedById) {
            updateData.approvedById = approvedById;
            updateData.approvedAt = new Date();
        }

        if (status === 'APPROVED') {
            if (!approvedById) {
                throw AppError.badRequest('APPROVER_ID_REQUIRED: approvedById must be provided.');
            }
            const goodsReceipt = await prisma.$transaction(async (tx) => {
                const existing = await tx.projectGoodsReceipt.findUnique({
                    where: { id },
                    select: { receivedById: true },
                });
                if (!existing) throw AppError.notFound('GOODS_RECEIPT_NOT_FOUND');
                // Segregation of duties: the receiver cannot approve their own GRN (global admin exempt).
                if (existing.receivedById === approvedById && !await userHasPermission(approvedById, RBAC_PERMISSIONS.ADMIN_RBAC)) {
                    throw AppError.badRequest('SEGREGATION_OF_DUTIES_VIOLATION: GRN creator cannot approve their own goods receipt.');
                }

                // Compare-and-set claim: only one approval may post stock/GL.
                const claim = await tx.projectGoodsReceipt.updateMany({
                    where: { id, status: { not: 'APPROVED' } },
                    data: updateData,
                });
                if (claim.count === 0) {
                    throw AppError.conflict('GOODS_RECEIPT_ALREADY_APPROVED');
                }
                const grn = await tx.projectGoodsReceipt.findUniqueOrThrow({
                    where: { id },
                    include: { items: true, project: true },
                });

                // Find appropriate store to deposit goods
                let store = null;
                if (grn.project.opmcId) {
                    store = await tx.inventoryStore.findFirst({
                        where: { opmcs: { some: { id: grn.project.opmcId } } }
                    });
                }
                if (!store) {
                    store = await tx.inventoryStore.findFirst({ where: { type: 'MAIN' } });
                }

                if (store) {
                    // Update stocks (accepted quantity only; fall back to received when accepted is not recorded)
                    for (const item of grn.items) {
                        const invItem = await tx.inventoryItem.findUnique({ where: { code: item.itemCode }});
                        if (!invItem) {
                            throw AppError.badRequest(`INVENTORY_ITEM_NOT_FOUND: ${item.itemCode}`);
                        }
                        const qty = Number(item.quantityAccepted ?? item.quantityReceived ?? 0);
                        if (!(qty > 0)) continue;

                        const before = await tx.inventoryStock.findUnique({
                            where: { storeId_itemId: { storeId: store.id, itemId: invItem.id } },
                            select: { quantity: true },
                        });
                        const stock = await tx.inventoryStock.upsert({
                            where: { storeId_itemId: { storeId: store.id, itemId: invItem.id } },
                            update: { quantity: { increment: qty } },
                            create: { storeId: store.id, itemId: invItem.id, quantity: qty, minLevel: 0 }
                        });

                        // Issues are picked from batches, so a receipt that only raised the store total
                        // could never be issued and would drift from the batch totals. Mirror the
                        // inventory GRN: one batch and one batch-stock row per accepted line.
                        const receiptUnitPrice = Number(item.unitPrice || 0);
                        const batch = await tx.inventoryBatch.create({
                            data: {
                                batchNumber: item.batchNumber || await AuditLedgerService.getNextDocumentNumber('LOT', tx as TransactionClient),
                                itemId: invItem.id,
                                initialQty: qty,
                                costPrice: receiptUnitPrice,
                                unitPrice: receiptUnitPrice,
                            },
                        });
                        await tx.inventoryBatchStock.create({
                            data: { storeId: store.id, batchId: batch.id, itemId: invItem.id, quantity: qty },
                        });

                        await AuditLedgerService.recordEntry({
                            storeId: store.id,
                            itemId: invItem.id,
                            transactionType: 'GRN_RECEIPT',
                            referenceType: 'GRN',
                            referenceId: grn.grnNumber,
                            quantityBefore: Number(before?.quantity ?? 0),
                            quantityChange: qty,
                            quantityAfter: Number(stock.quantity),
                            unitPrice: Number(item.unitPrice || 0),
                            performedById: approvedById,
                            idempotencyKey: `PROJECT_GRN:${grn.id}:${item.id}`,
                        }, tx as TransactionClient);

                        // Create transaction record
                        await tx.inventoryTransaction.create({
                            data: {
                                storeId: store.id,
                                type: 'IN',
                                // InventoryTransaction.referenceId is a UUID column; the GRN number is not one.
                                referenceId: grn.id,
                                userId: approvedById,
                                items: {
                                    create: [{
                                        itemId: invItem.id,
                                        quantity: qty
                                    }]
                                }
                            }
                        });
                    }
                }

                // Calculate total cost of items accepted in this GRN:
                const totalCost = grn.items.reduce((sum, item) => {
                    return sum + Number(item.unitPrice || 0) * Number(item.quantityAccepted ?? item.quantityReceived ?? 0);
                }, 0);

                if (totalCost > 0) {
                    const { LedgerService } = await import('@/services/finance/ledger.service');
                    await LedgerService.logGrnReceipt(
                        tx,
                        grn.id,
                        totalCost,
                        `Project Material Accrual (GRN: ${grn.grnNumber})`
                    );
                }

                return grn;
            // Stock, ledger and GL rows are written per line, so give a multi-line receipt more than the 5 s default.
            }, { maxWait: 10_000, timeout: 60_000 });
            return goodsReceipt;
        } else if (status === 'REJECTED') {
            // A rejected receipt gives its accepted quantities back to the purchase order, so the balance is not understated
            return prisma.$transaction(async (tx) => {
                const existing = await tx.projectGoodsReceipt.findUnique({ where: { id }, include: { items: true } });
                if (!existing) throw AppError.notFound('GOODS_RECEIPT_NOT_FOUND');
                if (existing.status === 'APPROVED') throw AppError.badRequest('GOODS_RECEIPT_ALREADY_APPROVED: stock has been posted, so it cannot be rejected');
                if (existing.status === 'REJECTED') return tx.projectGoodsReceipt.findUniqueOrThrow({ where: { id }, include: { items: true, project: true } });

                for (const gi of existing.items) {
                    const poItem = await tx.projectPurchaseOrderItem.findUnique({ where: { id: gi.poItemId } });
                    if (!poItem) continue;
                    const accepted = Number(gi.quantityAccepted ?? 0);
                    await tx.projectPurchaseOrderItem.update({
                        where: { id: poItem.id },
                        data: { receivedQty: Math.max(0, Number(poItem.receivedQty) - accepted), balanceQty: Number(poItem.balanceQty) + accepted },
                    });
                }
                const poItems = await tx.projectPurchaseOrderItem.findMany({ where: { poId: existing.poId } });
                const po = await tx.projectPurchaseOrder.findUnique({ where: { id: existing.poId }, select: { status: true, issuedAt: true } });
                if (po && ['PARTIALLY_RECEIVED', 'FULLY_RECEIVED'].includes(po.status)) {
                    const anyReceived = poItems.some((pi) => Number(pi.receivedQty) > 0);
                    const allReceived = poItems.every((pi) => Number(pi.balanceQty) <= 0);
                    await tx.projectPurchaseOrder.update({
                        where: { id: existing.poId },
                        data: { status: allReceived ? 'FULLY_RECEIVED' : anyReceived ? 'PARTIALLY_RECEIVED' : (po.issuedAt ? 'ISSUED' : 'APPROVED') },
                    });
                }
                return tx.projectGoodsReceipt.update({ where: { id }, data: updateData, include: { items: true, project: true } });
            });
        } else {
            const goodsReceipt = await prisma.projectGoodsReceipt.update({
                where: { id },
                data: updateData,
                include: { items: true, project: true },
            });
            return goodsReceipt;
        }
    }
}
