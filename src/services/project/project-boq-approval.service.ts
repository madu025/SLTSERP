import { prisma } from '@/lib/prisma';
import { AppError } from '@/lib/error';
import { AutoBOQService } from '@/services/project/auto-boq.service';
import { ProjectMaterialReservationService } from '@/services/project/project-material-reservation.service';
import { ProjectTaskPlanService } from '@/services/project/project-task-plan.service';
import { logger } from '@/lib/logger';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { getUserEffectivePermissions } from '@/lib/user-permissions';
import { assertProjectAccess } from '@/lib/project-access';
import { NotificationService } from '@/services/notification/notification.service';
import { WorkflowNotificationService } from '@/services/project/workflow-notification.service';
import { getBoqApprovalLevel, getBoqApprovalPolicy, hasEligiblePolicyRole, parseEligibleRoles } from '@/services/project/project-approval-policy.service';

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
    static async submitForApproval(projectId: string, actorUserId: string, notes?: string) {
        await assertProjectAccess(projectId, actorUserId);
        const capabilities = await getUserEffectivePermissions(actorUserId);
        if (!capabilities.includes(RBAC_PERMISSIONS.PROJECT_WRITE)) {
            throw AppError.forbidden(`${RBAC_PERMISSIONS.PROJECT_WRITE} is required to submit a BOQ`);
        }

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

        const policy = await getBoqApprovalPolicy();
        const approval = await prisma.bOQApproval.create({
            data: {
                boqId: projectId,
                projectId,
                policyId: policy.id,
                policyVariant: 'DEFAULT',
                status: 'PENDING',
                currentStep: 'SUPERVISOR',
                notes: notes || null,
            },
        });

        await prisma.project.update({
            where: { id: projectId },
            data: { status: 'BOQ_PENDING' },
        });

        await this.notifyStep(projectId, approval.id, 'SUPERVISOR', actorUserId);
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
        const isAdmin = await this.assertApprovalActor(projectId, step, userId, RBAC_PERMISSIONS.PROJECT_APPROVE, approval.policyId);
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

        await this.assertApprovalActor(projectId, approval.currentStep, userId, RBAC_PERMISSIONS.PROJECT_APPROVE, approval.policyId);

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

        await this.assertApprovalActor(projectId, 'PROJECT_MANAGER', userId, RBAC_PERMISSIONS.PROJECT_WRITE, approval.policyId);

        const { boq } = await AutoBOQService.generateBOQ(projectId);

        if (!boq.length) {
            throw AppError.badRequest('No approved survey points found for BOQ generation');
        }

        const newApproval = await prisma.$transaction(async (tx) => {
            const policy = await getBoqApprovalPolicy();
            const created = await tx.bOQApproval.create({
                data: {
                    boqId: projectId,
                    projectId,
                    policyId: policy.id,
                    policyVariant: 'DEFAULT',
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

    /** Tell the holders of the level that is now due. Before this, a three-level BOQ chain notified nobody. */
    private static async notifyStep(projectId: string, approvalId: string, step: string, actorId: string) {
        try {
            const { level } = await getBoqApprovalLevel(step);
            const project = await prisma.project.findUnique({ where: { id: projectId }, select: { name: true, projectCode: true } });
            await WorkflowNotificationService.notifyRoleHolders({
                projectId,
                roleCodes: parseEligibleRoles(level.eligibleRoles),
                title: '✅ BOQ awaiting your approval',
                message: `The BOQ for ${project?.name ?? 'a project'} (${project?.projectCode ?? ''}) is waiting for the ${step.replace(/_/g, ' ').toLowerCase()} approval.`,
                link: `/projects/${projectId}?tab=boq`,
                dedupBase: `boq-approval:${approvalId}:${step}`,
                metadata: { approvalId, step },
                excludeUserId: actorId,
            });
        } catch (error) {
            logger.error('[BOQ-APPROVAL-NOTIFY-FAILED]', { projectId, error });
        }
    }

    /** The BOQ is fully approved: the project supervisor can now build the task plan. */
    private static async notifyApproved(projectId: string, actorId: string) {
        try {
            const [project, supervisors] = await Promise.all([
                prisma.project.findUnique({ where: { id: projectId }, select: { name: true, projectCode: true } }),
                prisma.projectSupervisorAssignment.findMany({ where: { projectId, status: 'ASSIGNED', supervisorId: { not: actorId } }, select: { supervisorId: true } }),
            ]);
            for (const { supervisorId } of supervisors) {
                await NotificationService.send({
                    userId: supervisorId,
                    title: '📋 BOQ approved - build the task plan',
                    message: `The BOQ for ${project?.name ?? 'a project'} (${project?.projectCode ?? ''}) is approved. Open Tasks, configure the plan and submit it for approval.`,
                    type: 'PROJECT',
                    priority: 'HIGH',
                    link: '/projects/my-tasks',
                    metadata: { projectId },
                    dedupKey: `boq-approved-plan:${projectId}:${supervisorId}`,
                });
            }
        } catch (error) {
            logger.error('[BOQ-APPROVED-NOTIFY-FAILED]', { projectId, error });
        }
    }

    private static async assertApprovalActor(projectId: string, step: string, userId: string, requiredPermission: string = RBAC_PERMISSIONS.PROJECT_APPROVE, policyId?: string | null): Promise<boolean> {
        await assertProjectAccess(projectId, userId);
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

        const { policy, level } = await getBoqApprovalLevel(step);
        if (policyId && policyId !== policy.id) {
            throw AppError.conflict('BOQ approval policy changed; resubmit the BOQ under the active policy');
        }
        const roles = [actor.systemRole, ...actor.sectionAssignments.map(assignment => assignment.role)]
            .filter((role): role is { code: string; isActive: boolean } => !!role && role.isActive);
        if (!isAdmin && !hasEligiblePolicyRole(roles, level.eligibleRoles)) {
            throw AppError.forbidden(`User is not authorized for BOQ ${step} action under the active workflow policy`);
        }
        return isAdmin;
    }
}
