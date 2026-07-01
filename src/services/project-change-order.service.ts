import { prisma } from '@/lib/prisma';

interface CreateChangeOrderInput {
    projectId: string;
    title: string;
    description?: string | null;
    type?: string;
    priority?: string;
    reason?: string | null;
    referenceTable?: string | null;
    referenceId?: string | null;
    originalValue?: number | null;
    newValue?: number | null;
    costImpact?: number;
    timeImpact?: number | null;
    scopeImpact?: string | null;
    riskAssessment?: string | null;
    requestedById?: string | null;
    notes?: string | null;
}

interface UpdateChangeOrderInput {
    title?: string;
    description?: string;
    type?: string;
    priority?: string;
    reason?: string;
    referenceTable?: string;
    referenceId?: string;
    originalValue?: number;
    newValue?: number;
    costImpact?: number;
    timeImpact?: number;
    scopeImpact?: string;
    riskAssessment?: string;
    notes?: string;
    approvedById?: string | null;
    rejectionReason?: string | null;
    implementedById?: string | null;
}

export class ProjectChangeOrderService {
    /**
     * Get list of change orders for a project
     */
    static async getChangeOrders(projectId: string) {
        const changeOrders = await prisma.projectChangeOrder.findMany({
            where: { projectId },
            orderBy: { createdAt: 'desc' },
        });
        return changeOrders;
    }

    /**
     * Create a new change order in DRAFT status
     */
    static async createChangeOrder(data: CreateChangeOrderInput) {
        const {
            projectId, title, description, type, priority, reason,
            referenceTable, referenceId, originalValue, newValue, costImpact,
            timeImpact, scopeImpact, riskAssessment, requestedById, notes,
        } = data;

        // Verify project exists
        const project = await prisma.project.findUnique({ where: { id: projectId } });
        if (!project) {
            throw new Error('PROJECT_NOT_FOUND');
        }

        // Auto-generate CO number: CO-XXXXX
        const lastCO = await prisma.projectChangeOrder.findFirst({
            where: { projectId },
            orderBy: { coNumber: 'desc' },
            select: { coNumber: true },
        });

        let nextSeq = 1;
        if (lastCO?.coNumber) {
            const num = parseInt(lastCO.coNumber.split('-')[1] || '0', 10);
            nextSeq = num + 1;
        }
        const coNumber = `CO-${String(nextSeq).padStart(5, '0')}`;

        const changeOrder = await prisma.projectChangeOrder.create({
            data: {
                coNumber,
                projectId,
                title,
                description: description || null,
                type: type || 'SCOPE',
                priority: priority || 'MEDIUM',
                reason: reason || null,
                referenceTable: referenceTable || null,
                referenceId: referenceId || null,
                originalValue: originalValue != null ? originalValue : null,
                newValue: newValue != null ? newValue : null,
                costImpact: costImpact ?? 0,
                timeImpact: timeImpact != null ? timeImpact : null,
                scopeImpact: scopeImpact || null,
                riskAssessment: riskAssessment || null,
                requestedById: requestedById || null,
                notes: notes || null,
                status: 'DRAFT',
            },
        });

        return changeOrder;
    }

    /**
     * Update change order status or details
     */
    static async updateChangeOrder(id: string, action: string, updateData: UpdateChangeOrderInput) {
        // Fetch existing
        const existing = await prisma.projectChangeOrder.findUnique({ where: { id } });
        if (!existing) {
            throw new Error('CHANGE_ORDER_NOT_FOUND');
        }

        const data: Record<string, unknown> = {};

        if (action === 'SUBMIT') {
            if (existing.status !== 'DRAFT') {
                throw new Error('INVALID_STATUS_DRAFT_ONLY');
            }
            data.status = 'PENDING_APPROVAL';
        } else if (action === 'APPROVE') {
            if (existing.status !== 'PENDING_APPROVAL') {
                throw new Error('INVALID_STATUS_PENDING_ONLY');
            }
            data.status = 'APPROVED';
            data.approvedById = updateData.approvedById || null;
            data.approvedAt = new Date();
        } else if (action === 'REJECT') {
            if (existing.status !== 'PENDING_APPROVAL') {
                throw new Error('INVALID_STATUS_PENDING_ONLY');
            }
            data.status = 'REJECTED';
            data.rejectionReason = updateData.rejectionReason || null;
        } else if (action === 'IMPLEMENT') {
            if (existing.status !== 'APPROVED') {
                throw new Error('INVALID_STATUS_APPROVED_ONLY');
            }
            data.status = 'IMPLEMENTED';
            data.implementedById = updateData.implementedById || null;
            data.implementedAt = new Date();
        } else if (action === 'CANCEL') {
            if (existing.status === 'IMPLEMENTED' || existing.status === 'CANCELLED') {
                throw new Error('CANNOT_CANCEL_COMPLETED');
            }
            data.status = 'CANCELLED';
        } else if (action === 'UPDATE') {
            // Update editable fields for DRAFT/PENDING_APPROVAL
            if (existing.status !== 'DRAFT' && existing.status !== 'PENDING_APPROVAL') {
                throw new Error('CAN_ONLY_UPDATE_DRAFT_PENDING');
            }
            const { title, description, type, priority, reason, referenceTable, referenceId,
                originalValue, newValue, costImpact, timeImpact, scopeImpact, riskAssessment, notes } = updateData;
            if (title !== undefined) data.title = title;
            if (description !== undefined) data.description = description;
            if (type !== undefined) data.type = type;
            if (priority !== undefined) data.priority = priority;
            if (reason !== undefined) data.reason = reason;
            if (referenceTable !== undefined) data.referenceTable = referenceTable;
            if (referenceId !== undefined) data.referenceId = referenceId;
            if (originalValue !== undefined) data.originalValue = originalValue;
            if (newValue !== undefined) data.newValue = newValue;
            if (costImpact !== undefined) data.costImpact = costImpact;
            if (timeImpact !== undefined) data.timeImpact = timeImpact;
            if (scopeImpact !== undefined) data.scopeImpact = scopeImpact;
            if (riskAssessment !== undefined) data.riskAssessment = riskAssessment;
            if (notes !== undefined) data.notes = notes;
        } else {
            throw new Error('INVALID_ACTION');
        }

        const updated = await prisma.projectChangeOrder.update({
            where: { id },
            data,
        });

        return updated;
    }

    /**
     * Delete a change order (DRAFT only)
     */
    static async deleteChangeOrder(id: string) {
        const existing = await prisma.projectChangeOrder.findUnique({ where: { id } });
        if (!existing) {
            throw new Error('CHANGE_ORDER_NOT_FOUND');
        }
        if (existing.status !== 'DRAFT') {
            throw new Error('DRAFT_ONLY_DELETION');
        }

        await prisma.projectChangeOrder.delete({ where: { id } });
        return { success: true };
    }
}
