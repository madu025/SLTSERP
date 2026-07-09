import { prisma } from '@/lib/prisma';

interface RequisitionItemInput {
    boqItemId?: string | null;
    itemCode: string;
    description: string;
    unit?: string;
    quantity: number;
    estimatedPrice: number;
    notes?: string | null;
}

interface CreateRequisitionInput {
    projectId: string;
    title: string;
    description?: string;
    priority?: string;
    type?: string;
    deliveryLocation?: string;
    requiredDate?: string | Date;
    requestedById: string;
    vendorId?: string | null;
    items: RequisitionItemInput[];
    remarks?: string;
}

export class ProjectRequisitionService {
    /**
     * Get list of requisitions for a project
     */
    static async getRequisitions(projectId: string) {
        const requisitions = await prisma.projectRequisition.findMany({
            where: { projectId },
            include: {
                items: true,
                vendor: true,
                quotations: {
                    include: { items: true }
                },
                purchaseOrders: {
                    include: { items: true }
                }
            },
            orderBy: { createdAt: 'desc' },
        });
        return requisitions;
    }

    /**
     * Create a new requisition with items in a transaction
     */
    static async createRequisition(data: CreateRequisitionInput) {
        const {
            projectId,
            title,
            description,
            priority,
            type,
            deliveryLocation,
            requiredDate,
            requestedById,
            vendorId,
            items,
            remarks,
        } = data;

        // Verify project exists
        const project = await prisma.project.findUnique({ where: { id: projectId } });
        if (!project) {
            throw new Error('PROJECT_NOT_FOUND');
        }

        // Auto-generate PR number
        const lastPR = await prisma.projectRequisition.findFirst({
            orderBy: { prNumber: 'desc' },
            select: { prNumber: true },
        });

        let nextPRNumber: string;
        if (lastPR && lastPR.prNumber) {
            const lastNum = parseInt(lastPR.prNumber.replace('PR-', ''), 10);
            const nextNum = isNaN(lastNum) ? 1 : lastNum + 1;
            nextPRNumber = 'PR-' + String(nextNum).padStart(5, '0');
        } else {
            nextPRNumber = 'PR-00001';
        }

        // Calculate total from items
        const estimatedTotal = items.reduce((sum, item) => {
            return sum + (item.estimatedPrice || 0) * (item.quantity || 0);
        }, 0);

        // Use transaction to create requisition + items
        const requisition = await prisma.$transaction(async (tx) => {
            const newReq = await tx.projectRequisition.create({
                data: {
                    prNumber: nextPRNumber,
                    projectId,
                    title,
                    description: description || null,
                    priority: priority || 'MEDIUM',
                    type: type || 'MATERIAL',
                    deliveryLocation: deliveryLocation || null,
                    requiredDate: requiredDate ? new Date(requiredDate) : null,
                    requestedById,
                    vendorId: vendorId || null,
                    estimatedTotal,
                    remarks: remarks || null,
                    items: {
                        create: items.map((item) => ({
                            boqItemId: item.boqItemId || null,
                            itemCode: item.itemCode,
                            description: item.description,
                            unit: item.unit || 'NOS',
                            quantity: item.quantity || 0,
                            estimatedPrice: item.estimatedPrice || 0,
                            totalEstimated: (item.estimatedPrice || 0) * (item.quantity || 0),
                            notes: item.notes || null,
                        })),
                    },
                },
                include: { items: true, vendor: true },
            });
            return newReq;
        });

        return requisition;
    }

    /**
     * Update requisition status
     */
    static async updateRequisitionStatus(id: string, status: string, approvedById?: string | null, rejectionReason?: string | null) {
        // Validate status transitions
        const validStatuses = ['DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'];
        if (!validStatuses.includes(status)) {
            throw new Error('INVALID_STATUS');
        }

        const existing = await prisma.projectRequisition.findUnique({ where: { id } });
        if (!existing) {
            throw new Error('REQUISITION_NOT_FOUND');
        }

        // Only allow status transitions from DRAFT or PENDING
        if (existing.status === 'APPROVED' || existing.status === 'REJECTED' || existing.status === 'CANCELLED') {
            throw new Error('STATUS_LOCKED');
        }

        const updateData: Record<string, unknown> = { status };
        if (status === 'APPROVED' && approvedById) {
            updateData.approvedById = approvedById;
            updateData.approvedAt = new Date();
        }
        if (status === 'REJECTED') {
            updateData.rejectionReason = rejectionReason || null;
        }

        const requisition = await prisma.projectRequisition.update({
            where: { id },
            data: updateData,
            include: { items: true, vendor: true },
        });

        return requisition;
    }

    /**
     * Delete a requisition (DRAFT only)
     */
    static async deleteRequisition(id: string) {
        const existing = await prisma.projectRequisition.findUnique({ where: { id } });
        if (!existing) {
            throw new Error('REQUISITION_NOT_FOUND');
        }

        if (existing.status !== 'DRAFT') {
            throw new Error('DRAFT_ONLY_DELETION');
        }

        await prisma.projectRequisition.delete({ where: { id } });
        return { success: true };
    }
}
