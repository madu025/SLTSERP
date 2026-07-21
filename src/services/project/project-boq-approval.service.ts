import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';
import { AutoBOQService } from '@/services/auto-boq.service';

export class ProjectBOQApprovalService {
    /**
     * Get the current BOQ approval status and items
     */
    static async getApprovalStatus(projectId: string) {
        const [approval, boqItems] = await Promise.all([
            prisma.bOQApproval.findFirst({
                where: { projectId },
                orderBy: { createdAt: 'desc' },
            }),
            prisma.projectBOQItem.findMany({
                where: { projectId },
                select: {
                    id: true,
                    category: true,
                    itemCode: true,
                    description: true,
                    unit: true,
                    quantity: true,
                    unitRate: true,
                    amount: true,
                    source: true,
                },
                orderBy: [{ category: 'asc' }, { itemCode: 'asc' }],
            }),
        ]);

        // Category totals
        const categoryTotals: Record<string, number> = {};
        let grandTotal = 0;
        for (const item of boqItems) {
            categoryTotals[item.category || 'OTHER'] = (categoryTotals[item.category || 'OTHER'] || 0) + item.amount;
            grandTotal += item.amount;
        }

        return {
            approval: approval || { status: 'NOT_GENERATED', message: 'BOQ not yet generated' },
            boqItems,
            summary: {
                categories: categoryTotals,
                totalItems: boqItems.length,
                grandTotal,
            },
        };
    }

    /**
     * Submit BOQ for approval
     */
    static async submitForApproval(projectId: string, notes?: string) {
        const boqCount = await prisma.projectBOQItem.count({ where: { projectId } });
        if (boqCount === 0) {
            throw AppError.badRequest('No BOQ items found. Generate BOQ first via POST /api/projects/{id}/boq/generate');
        }

        const existing = await prisma.bOQApproval.findFirst({
            where: {
                projectId,
                status: { in: ['PENDING', 'APPROVED'] },
            },
        });

        if (existing) {
            throw AppError.conflict(`BOQ is already ${existing.status}. Revise or reject first before resubmitting.`);
        }

        const approval = await prisma.bOQApproval.create({
            data: {
                boqId: projectId,
                projectId,
                status: 'PENDING',
                currentStep: 'SUPERVISOR',
                notes: notes || null,
            },
        });

        await prisma.project.update({
            where: { id: projectId },
            data: { status: 'BOQ_PENDING' },
        });

        return { message: 'BOQ submitted for approval', approval };
    }

    /**
     * Approve BOQ current step
     */
    static async approve(projectId: string, userId: string, notes?: string) {
        const approval = await prisma.bOQApproval.findFirst({
            where: { projectId, status: 'PENDING' },
        });

        if (!approval) {
            throw AppError.notFound('No pending BOQ approval found');
        }

        const step = approval.currentStep;
        const updateData: Record<string, unknown> = {};

        if (step === 'SUPERVISOR') {
            updateData.currentStep = 'PROJECT_MANAGER';
            updateData.supervisorId = userId;
            updateData.supervisorApprovedAt = new Date();
        } else if (step === 'PROJECT_MANAGER') {
            updateData.currentStep = 'FINANCE';
            updateData.pmId = userId;
            updateData.pmApprovedAt = new Date();
        } else if (step === 'FINANCE') {
            updateData.status = 'APPROVED';
            updateData.financeId = userId;
            updateData.financeApprovedAt = new Date();
        }

        if (notes) updateData.notes = notes;

        const updated = await prisma.bOQApproval.update({
            where: { id: approval.id },
            data: updateData,
        });

        if (updated.status === 'APPROVED') {
            const boqTotal = await prisma.projectBOQItem.aggregate({
                where: { projectId },
                _sum: { amount: true },
            });

            await prisma.project.update({
                where: { id: projectId },
                data: {
                    status: 'BOQ_APPROVED',
                    budget: boqTotal._sum.amount ?? 0,
                },
            });
        }

        return {
            message: `BOQ step ${step} approved`,
            approval: updated,
            nextStep: updated.status === 'APPROVED' ? null : updated.currentStep,
        };
    }

    /**
     * Reject BOQ
     */
    static async reject(projectId: string, notes: string) {
        if (!notes) {
            throw AppError.badRequest('Notes are required when rejecting BOQ');
        }

        const approval = await prisma.bOQApproval.findFirst({
            where: { projectId, status: 'PENDING' },
        });

        if (!approval) {
            throw AppError.notFound('No pending BOQ approval found');
        }

        const updated = await prisma.bOQApproval.update({
            where: { id: approval.id },
            data: {
                status: 'REJECTED',
                rejectionReason: notes,
                notes,
            },
        });

        await prisma.project.update({
            where: { id: projectId },
            data: { status: 'BOQ_REVISION' },
        });

        return { message: 'BOQ rejected', approval: updated };
    }

    /**
     * Revise rejected BOQ
     */
    static async revise(projectId: string, notes?: string) {
        const approval = await prisma.bOQApproval.findFirst({
            where: { projectId, status: 'REJECTED' },
        });

        if (!approval) {
            throw AppError.notFound('No rejected BOQ found to revise. Re-generate BOQ first if needed.');
        }

        const { boq } = await AutoBOQService.generateBOQ(projectId);

        if (!boq.length) {
            throw AppError.badRequest('No approved survey points found for BOQ generation');
        }

        const newApproval = await prisma.bOQApproval.create({
            data: {
                boqId: projectId,
                projectId,
                status: 'PENDING',
                currentStep: 'SUPERVISOR',
                notes: notes || `Revised from rejection: ${approval.rejectionReason || approval.notes}`,
            },
        });

        return { message: 'BOQ revised and resubmitted', approval: newApproval, boq };
    }
}
