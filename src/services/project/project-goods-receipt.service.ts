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

        // Verify PO exists
        const po = await prisma.projectPurchaseOrder.findUnique({
            where: { id: poId }
        });
        if (!po) {
            throw AppError.badRequest('PURCHASE_ORDER_NOT_FOUND');
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
                        create: items.map((item) => ({
                            poItemId: item.poItemId,
                            itemCode: item.itemCode,
                            description: item.description,
                            unit: item.unit || 'NOS',
                            quantityOrdered: item.quantityOrdered || 0,
                            quantityReceived: item.quantityReceived || 0,
                            quantityAccepted: item.quantityAccepted || item.quantityReceived || 0,
                            quantityRejected: item.quantityRejected || 0,
                            rejectionReason: item.rejectionReason || null,
                            unitPrice: item.unitPrice || 0,
                            totalPrice: (item.unitPrice || 0) * (item.quantityReceived || 0),
                            batchNumber: item.batchNumber || null,
                            serialNumbers: item.serialNumbers || [],
                            notes: item.notes || null,
                        })),
                    },
                },
                include: { items: true },
            });

            // Update PO item received/balance quantities
            for (const item of items) {
                if (item.poItemId) {
                    const poItem = await tx.projectPurchaseOrderItem.findUnique({
                        where: { id: item.poItemId }
                    });
                    if (poItem) {
                        const newReceived = Number(poItem.receivedQty || 0) + Number(item.quantityReceived || 0);
                        const newBalance = Number(poItem.balanceQty || 0) - Number(item.quantityReceived || 0);
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
                                referenceId: grn.grnNumber,
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
            });
            return goodsReceipt;
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
