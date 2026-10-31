import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';
import { AutoBOQService } from '@/services/project/auto-boq.service';
import { ProjectMaterialReservationService } from '@/services/project/project-material-reservation.service';
import { ProjectTaskPlanService } from '@/services/project/project-task-plan.service';
import { ROLE_GROUPS } from '@/config/roles';
import { logger } from '@/lib/logger';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { getUserEffectivePermissions } from '@/lib/user-permissions';

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
            categoryTotals[item.category || 'OTHER'] = (categoryTotals[item.category || 'OTHER'] || 0) + Number(item.amount);
            grandTotal += Number(item.amount);
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
        const isAdmin = await this.assertApprovalActor(step, userId);
        // Maker-checker: the same user cannot approve more than one step (global admin override).
        const earlierApprovers = [approval.supervisorId, approval.pmId, approval.financeId];
        if (!isAdmin && earlierApprovers.includes(userId)) {
            throw AppError.forbidden('You already approved an earlier step of this BOQ; a different approver is required');
        }
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

        const updated = await prisma.$transaction(async (tx) => {
            const updatedApproval = await tx.bOQApproval.update({
                where: { id: approval.id },
                data: updateData,
            });

            if (updatedApproval.status === 'APPROVED') {
                const boqTotal = await tx.projectBOQItem.aggregate({
                    where: { projectId },
                    _sum: { amount: true },
                });

                await tx.project.update({
                    where: { id: projectId },
                    data: {
                        status: 'BOQ_APPROVED',
                        budget: boqTotal._sum.amount ?? 0,
                    },
                });

                // BOQ approval creates demand records only. Store reservation is a
                // separate, auditable action so project approval never deducts or
                // silently holds physical inventory. Keep both writes atomic.
                await ProjectMaterialReservationService.syncForProject(projectId, tx);
            }
            return updatedApproval;
        });

        let taskPlanSync: 'SYNCED' | 'NOT_REQUIRED' | 'ATTENTION' = 'NOT_REQUIRED';
        if (updated.status === 'APPROVED') {
            try {
                await ProjectTaskPlanService.syncApprovedBoq(projectId, userId, { automation: true });
                taskPlanSync = 'SYNCED';
            } catch (error) {
                taskPlanSync = 'ATTENTION';
                logger.error('[BOQ-TASK-PLAN-SYNC-FAILED]', { projectId, error });
            }
        }

        return {
            message: `BOQ step ${step} approved`,
            approval: updated,
            materialRequirementsCreated: updated.status === 'APPROVED',
            taskPlanSync,
            nextStep: updated.status === 'APPROVED' ? null : updated.currentStep,
        };
    }

    /**
     * Reject BOQ
     */
    static async reject(projectId: string, userId: string, notes: string) {
        if (!notes) {
            throw AppError.badRequest('Notes are required when rejecting BOQ');
        }

        const approval = await prisma.bOQApproval.findFirst({
            where: { projectId, status: 'PENDING' },
        });

        if (!approval) {
            throw AppError.notFound('No pending BOQ approval found');
        }

        await this.assertApprovalActor(approval.currentStep, userId);

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
    static async revise(projectId: string, userId: string, notes?: string) {
        const approval = await prisma.bOQApproval.findFirst({
            where: { projectId },
            orderBy: { createdAt: 'desc' },
        });

        if (!approval || approval.status !== 'REJECTED') {
            throw AppError.notFound('No rejected BOQ found to revise. Re-generate BOQ first if needed.');
        }
        const open = await prisma.bOQApproval.findFirst({
            where: { projectId, status: { in: ['PENDING', 'APPROVED'] } },
            select: { status: true },
        });
        if (open) {
            throw AppError.conflict(`BOQ is already ${open.status}; it cannot be revised.`);
        }

        await this.assertApprovalActor('PROJECT_MANAGER', userId, RBAC_PERMISSIONS.PROJECT_WRITE);

        const { boq } = await AutoBOQService.generateBOQ(projectId);

        if (!boq.length) {
            throw AppError.badRequest('No approved survey points found for BOQ generation');
        }

        const newApproval = await prisma.$transaction(async (tx) => {
            const created = await tx.bOQApproval.create({
                data: {
                    boqId: projectId,
                    projectId,
                    status: 'PENDING',
                    currentStep: 'SUPERVISOR',
                    notes: notes || `Revised from rejection: ${approval.rejectionReason || approval.notes}`,
                },
            });
            await tx.project.update({
                where: { id: projectId },
                data: { status: 'BOQ_PENDING' },
            });
            return created;
        });

        return { message: 'BOQ revised and resubmitted', approval: newApproval, boq };
    }

    private static async assertApprovalActor(step: string, userId: string, requiredPermission: string = RBAC_PERMISSIONS.PROJECT_APPROVE): Promise<boolean> {
        const actor = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                status: true,
                systemRole: { select: { code: true, isActive: true } },
                sectionAssignments: { select: { role: { select: { code: true, isActive: true } } } },
            },
        });
        if (!actor || actor.status !== 'active') {
            throw AppError.unauthorized('Authenticated approver is not active');
        }
        const capabilities = await getUserEffectivePermissions(userId);
        if (!capabilities.includes(requiredPermission)) {
            throw AppError.forbidden(`${requiredPermission} is required for this BOQ action`);
        }
        const isAdmin = capabilities.includes(RBAC_PERMISSIONS.ADMIN_RBAC);

        const allowedRolesByStep: Record<string, string[]> = {
            SUPERVISOR: [...new Set([...ROLE_GROUPS.ADMINS, 'OSP_MANAGER', 'AREA_MANAGER', 'ENGINEER', 'ASSISTANT_ENGINEER', 'QC_OFFICER', 'OSP_ENGINEER', 'CIVIL_SUPERVISOR'])],
            PROJECT_MANAGER: [...new Set([...ROLE_GROUPS.ADMINS, 'MANAGER', 'OSP_MANAGER', 'AREA_MANAGER'])],
            FINANCE: ROLE_GROUPS.FINANCE_APPROVERS,
        };
        const roles = [actor.systemRole, ...actor.sectionAssignments.map(assignment => assignment.role)]
            .filter((role): role is { code: string; isActive: boolean } => !!role && role.isActive)
            .map(role => role.code.replace(/_GLOBAL$/, ''));
        if (!isAdmin && !roles.some(code => allowedRolesByStep[step]?.includes(code))) {
            throw AppError.forbidden(`User role is not authorized for BOQ ${step} action`);
        }
        return isAdmin;
    }
}
