import { AppError } from '@/lib/error';
import { prisma } from '@/lib/prisma';

interface POItemInput {
    requisitionItemId?: string | null;
    itemCode: string;
    description: string;
    unit?: string;
    quantity: number;
    unitPrice: number;
    deliveryDate?: string | Date | null;
    notes?: string | null;
}

interface CreatePurchaseOrderInput {
    projectId: string;
    requisitionId?: string | null;
    vendorId: string;
    vendorName?: string;
    title: string;
    description?: string | null;
    priority?: string;
    type?: string;
    expectedDelivery?: string | Date | null;
    deliveryLocation?: string | null;
    items: POItemInput[];
    paymentTerms?: string | null;
    deliveryTerms?: string | null;
    notes?: string | null;
}

interface UpdatePOStatusOptions {
    approvedById?: string | null;
    issuedById?: string | null;
    closedById?: string | null;
    cancellationReason?: string | null;
}

export class ProjectPurchaseOrderService {
    /**
     * Get list of purchase orders for a project
     */
    static async getPurchaseOrders(projectId: string) {
        const purchaseOrders = await prisma.projectPurchaseOrder.findMany({
            where: { projectId },
            include: {
                items: true,
                requisition: {
                    select: { prNumber: true, title: true }
                },
                goodsReceipts: {
                    include: { items: true }
                }
            },
            orderBy: { createdAt: 'desc' },
        });
        return purchaseOrders;
    }

    /**
     * Create a new purchase order with items in a transaction
     */
    static async createPurchaseOrder(data: CreatePurchaseOrderInput) {
        const {
            projectId,
            requisitionId,
            vendorId,
            vendorName,
            title,
            description,
            priority,
            type,
            expectedDelivery,
            deliveryLocation,
            items,
            paymentTerms,
            deliveryTerms,
            notes,
        } = data;

        // Verify project exists
        const project = await prisma.project.findUnique({ where: { id: projectId } });
        if (!project) {
            throw AppError.badRequest('PROJECT_NOT_FOUND');
        }

        // Auto-generate PO number
        const lastPO = await prisma.projectPurchaseOrder.findFirst({
            orderBy: { poNumber: 'desc' },
            select: { poNumber: true },
        });

        let nextPONumber: string;
        if (lastPO && lastPO.poNumber) {
            const lastNum = parseInt(lastPO.poNumber.replace('PO-', ''), 10);
            const nextNum = isNaN(lastNum) ? 1 : lastNum + 1;
            nextPONumber = 'PO-' + String(nextNum).padStart(5, '0');
        } else {
            nextPONumber = 'PO-00001';
        }

        // Calculate totals from items
        let subtotal = 0;
        const itemsData = items.map((item) => {
            const totalPrice = (item.unitPrice || 0) * (item.quantity || 0);
            subtotal += totalPrice;
            return {
                requisitionItemId: item.requisitionItemId || null,
                itemCode: item.itemCode,
                description: item.description,
                unit: item.unit || 'NOS',
                quantity: item.quantity || 0,
                unitPrice: item.unitPrice || 0,
                totalPrice,
                receivedQty: 0,
                balanceQty: item.quantity || 0,
                deliveryDate: item.deliveryDate ? new Date(item.deliveryDate) : null,
                notes: item.notes || null,
            };
        });

        // Use transaction to create PO + items
        const purchaseOrder = await prisma.$transaction(async (tx) => {
            const newPO = await tx.projectPurchaseOrder.create({
                data: {
                    poNumber: nextPONumber,
                    projectId,
                    requisitionId: requisitionId || null,
                    vendorId,
                    vendorName: vendorName || '',
                    title,
                    description: description || null,
                    priority: priority || 'MEDIUM',
                    type: type || 'MATERIAL',
                    expectedDelivery: expectedDelivery ? new Date(expectedDelivery) : null,
                    deliveryLocation: deliveryLocation || null,
                    subtotal,
                    taxAmount: 0,
                    discountAmount: 0,
                    totalAmount: subtotal,
                    paymentTerms: paymentTerms || null,
                    deliveryTerms: deliveryTerms || null,
                    notes: notes || null,
                    items: { create: itemsData },
                },
                include: { items: true },
            });
            return newPO;
        });

        return purchaseOrder;
    }

    /**
     * Update PO status with options parameters
     */
    static async updatePurchaseOrderStatus(id: string, status: string, options: UpdatePOStatusOptions) {
        const existing = await prisma.projectPurchaseOrder.findUnique({ where: { id } });
        if (!existing) {
            throw AppError.badRequest('PURCHASE_ORDER_NOT_FOUND');
        }

        const finalizedStatuses = ['FULLY_RECEIVED', 'CLOSED', 'CANCELLED'];
        if (finalizedStatuses.includes(existing.status)) {
            throw AppError.badRequest('STATUS_LOCKED');
        }

        const updateData: Record<string, unknown> = { status };

        switch (status) {
            case 'APPROVED':
                if (!options.approvedById) {
                    throw AppError.badRequest('APPROVED_BY_ID_REQUIRED');
                }
                updateData.approvedById = options.approvedById;
                updateData.approvedAt = new Date();
                break;
            case 'ISSUED':
                if (!options.issuedById) {
                    throw AppError.badRequest('ISSUED_BY_ID_REQUIRED');
                }
                updateData.issuedById = options.issuedById;
                updateData.issuedAt = new Date();
                break;
            case 'CLOSED':
                if (!options.closedById) {
                    throw AppError.badRequest('CLOSED_BY_ID_REQUIRED');
                }
                updateData.closedById = options.closedById;
                updateData.closedAt = new Date();
                break;
            case 'CANCELLED':
                updateData.cancellationReason = options.cancellationReason || null;
                break;
            default:
                break;
        }

        const purchaseOrder = await prisma.projectPurchaseOrder.update({
            where: { id },
            data: updateData,
            include: { items: true },
        });

        return purchaseOrder;
    }

    /**
     * Delete a PO (DRAFT only)
     */
    static async deletePurchaseOrder(id: string) {
        const existing = await prisma.projectPurchaseOrder.findUnique({ where: { id } });
        if (!existing) {
            throw AppError.badRequest('PURCHASE_ORDER_NOT_FOUND');
        }

        if (existing.status !== 'DRAFT') {
            throw AppError.badRequest('DRAFT_ONLY_DELETION');
        }

        await prisma.projectPurchaseOrder.delete({ where: { id } });
        return { success: true };
    }
}
