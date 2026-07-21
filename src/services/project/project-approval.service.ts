import { prisma } from '@/lib/prisma';
import { NotificationService } from '@/services/notification.service';
import { AppError } from '@/lib/error';

interface CreateApprovalStepInput {
    stepNumber: number;
    roleRequired: string;
    assignedUserId?: string | null;
}

interface CreateApprovalRequestInput {
    projectId: string;
    type: string;
    referenceId: string;
    title: string;
    description?: string | null;
    amount?: number | null;
    steps: CreateApprovalStepInput[];
}

export class ProjectApprovalService {
    static async getApprovals(projectId: string) {
        return await prisma.projectApprovalRequest.findMany({
            where: { projectId },
            include: {
                steps: {
                    orderBy: { stepNumber: 'asc' },
                    include: {
                        assignedUser: { select: { id: true, name: true, role: true } },
                        actionedBy: { select: { id: true, name: true, role: true } }
                    }
                },
                document: { select: { id: true, title: true, currentVersion: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
    }

    static async createApproval(data: CreateApprovalRequestInput) {
        const { projectId, type, referenceId, title, description, amount, steps } = data;

        const newRequest = await prisma.$transaction(async (tx) => {
            const req = await tx.projectApprovalRequest.create({
                data: {
                    projectId,
                    type,
                    referenceId,
                    documentId: type === 'DOCUMENT' ? referenceId : null,
                    title,
                    description: description || null,
                    amount: amount ? Number(amount) : null,
                    status: 'PENDING'
                }
            });

            const stepRecords = steps.map((s) => ({
                requestId: req.id,
                stepNumber: s.stepNumber,
                roleRequired: s.roleRequired,
                assignedUserId: s.assignedUserId || null,
                status: 'PENDING'
            }));

            await tx.projectApprovalStep.createMany({
                data: stepRecords
            });

            if (type === 'DOCUMENT') {
                await tx.projectDocument.update({
                    where: { id: referenceId },
                    data: { status: 'UNDER_REVIEW' }
                });
            }

            return req;
        });

        // Fire notifications asynchronously
        (async () => {
            try {
                const firstSteps = steps.filter(s => s.stepNumber === 1);
                for (const s of firstSteps) {
                    if (s.assignedUserId) {
                        await NotificationService.send({
                            userId: s.assignedUserId,
                            title: '✅ Approval Required',
                            message: `A new approval request "${title}" requires your action.`,
                            type: 'PROJECT',
                            priority: 'HIGH',
                            link: `/projects/${projectId}/approvals`,
                            metadata: { requestId: newRequest.id, projectId, approvalType: type }
                        });
                    } else {
                        await NotificationService.notifyByRole({
                            roles: [s.roleRequired],
                            title: '✅ Approval Required',
                            message: `A new approval request "${title}" requires your action as ${s.roleRequired.replace(/_/g, ' ')}.`,
                            type: 'PROJECT',
                            priority: 'HIGH',
                            link: `/projects/${projectId}/approvals`,
                            metadata: { requestId: newRequest.id, projectId, approvalType: type }
                        });
                    }
                }
            } catch (notifErr) {
                console.error('Failed to send approval creation notifications:', notifErr);
            }
        })();

        return newRequest;
    }

    static async processApprovalStep(stepId: string, action: string, actionedById: string, comment?: string | null) {
        const step = await prisma.projectApprovalStep.findUnique({
            where: { id: stepId },
            include: { request: true }
        });

        if (!step) {
            throw AppError.notFound('Approval step not found');
        }

        const projectId = step.request.projectId;
        const currentStepNumber = step.stepNumber;

        const updatedRequest = await prisma.$transaction(async (tx) => {
            await tx.projectApprovalStep.update({
                where: { id: stepId },
                data: {
                    status: action,
                    actionedById,
                    actionedAt: new Date(),
                    comment: comment || null
                }
            });

            const allSteps = await tx.projectApprovalStep.findMany({
                where: { requestId: step.requestId },
                orderBy: { stepNumber: 'asc' }
            });

            const stepsWithCurrent = allSteps.map(s => s.id === stepId ? { ...s, status: action } : s);

            let finalStatus = 'PENDING';
            if (action === 'REJECTED') {
                finalStatus = 'REJECTED';
            } else {
                const allApproved = stepsWithCurrent.every(s => s.status === 'APPROVED');
                if (allApproved) {
                    finalStatus = 'APPROVED';
                }
            }

            if (finalStatus !== 'PENDING') {
                await tx.projectApprovalRequest.update({
                    where: { id: step.requestId },
                    data: { status: finalStatus }
                });

                if (step.request.type === 'DOCUMENT') {
                    await tx.projectDocument.update({
                        where: { id: step.request.referenceId },
                        data: { status: finalStatus }
                    });
                }
            }

            return await tx.projectApprovalRequest.findUnique({
                where: { id: step.requestId },
                include: { steps: { orderBy: { stepNumber: 'asc' } } }
            });
        });

        // Notifications
        (async () => {
            try {
                const requestTitle = step.request.title;
                const approvalLink = `/projects/${projectId}/approvals`;

                const project = await prisma.project.findUnique({
                    where: { id: projectId },
                    select: { areaManagerId: true, name: true }
                });

                if (action === 'REJECTED') {
                    if (project?.areaManagerId) {
                        await NotificationService.send({
                            userId: project.areaManagerId,
                            title: '❌ Approval Rejected',
                            message: `Approval request "${requestTitle}" for project "${project.name}" was rejected at step ${currentStepNumber}.${comment ? ` Reason: ${comment}` : ''}`,
                            type: 'PROJECT',
                            priority: 'CRITICAL',
                            link: approvalLink,
                            metadata: { requestId: step.requestId, projectId, stepNumber: currentStepNumber }
                        });
                    }
                    await NotificationService.notifyByRole({
                        roles: ['SUPER_ADMIN', 'ADMIN', 'OSP_MANAGER', 'AREA_MANAGER'],
                        title: '❌ Project Approval Rejected',
                        message: `Approval "${requestTitle}" was rejected at step ${currentStepNumber}.${comment ? ` Reason: ${comment}` : ''}`,
                        type: 'PROJECT',
                        priority: 'HIGH',
                        link: approvalLink,
                        metadata: { requestId: step.requestId, projectId }
                    });

                } else if (action === 'APPROVED') {
                    const allSteps = updatedRequest?.steps || [];
                    const allApproved = allSteps.every((s: any) => s.status === 'APPROVED');

                    if (allApproved) {
                        if (project?.areaManagerId) {
                            await NotificationService.send({
                                userId: project.areaManagerId,
                                title: '🎉 Approval Fully Completed',
                                message: `All approval steps for "${requestTitle}" (project: ${project.name}) have been fully approved.`,
                                type: 'PROJECT',
                                priority: 'HIGH',
                                link: approvalLink,
                                metadata: { requestId: step.requestId, projectId }
                            });
                        }
                        await NotificationService.notifyByRole({
                            roles: ['SUPER_ADMIN', 'ADMIN', 'OSP_MANAGER'],
                            title: '🎉 Approval Completed',
                            message: `All approval steps for "${requestTitle}" have been completed.`,
                            type: 'PROJECT',
                            priority: 'MEDIUM',
                            link: approvalLink,
                            metadata: { requestId: step.requestId, projectId }
                        });
                    } else {
                        const nextStep = (updatedRequest?.steps || []).find(
                            (s: any) => s.stepNumber === currentStepNumber + 1
                        ) as any;

                        if (nextStep) {
                            if (nextStep.assignedUserId) {
                                await NotificationService.send({
                                    userId: nextStep.assignedUserId,
                                    title: '✅ Approval Required — Your Turn',
                                    message: `Step ${currentStepNumber} was approved. "${requestTitle}" now requires your approval (Step ${nextStep.stepNumber}).`,
                                    type: 'PROJECT',
                                    priority: 'HIGH',
                                    link: approvalLink,
                                    metadata: { requestId: step.requestId, projectId, stepNumber: nextStep.stepNumber }
                                });
                            } else {
                                await NotificationService.notifyByRole({
                                    roles: [nextStep.roleRequired],
                                    title: '✅ Approval Required — Your Turn',
                                    message: `Step ${currentStepNumber} was approved. "${requestTitle}" now requires approval from ${nextStep.roleRequired.replace(/_/g, ' ')} (Step ${nextStep.stepNumber}).`,
                                    type: 'PROJECT',
                                    priority: 'HIGH',
                                    link: approvalLink,
                                    metadata: { requestId: step.requestId, projectId, stepNumber: nextStep.stepNumber }
                                });
                            }
                        }
                    }
                }
            } catch (notifErr) {
                console.error('Failed to send approval step notifications:', notifErr);
            }
        })();

        return updatedRequest;
    }
}