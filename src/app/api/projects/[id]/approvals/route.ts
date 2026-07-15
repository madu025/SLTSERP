import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { NotificationService } from '@/services/notification.service';

// GET: Fetch approval requests with their steps for a project
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: projectId } = await params;

        const approvals = await prisma.projectApprovalRequest.findMany({
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

        return NextResponse.json(approvals);
    } catch (error) {
        console.error('Error fetching project approvals:', error);
        return NextResponse.json({ error: 'Failed to fetch approval requests' }, { status: 500 });
    }
}

// POST: Create a new multi-level approval request
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: projectId } = await params;
        const body = await request.json();
        const { type, referenceId, title, description, amount, steps } = body;

        if (!type || !referenceId || !title || !steps || !Array.isArray(steps) || steps.length === 0) {
            return NextResponse.json({ error: 'Missing required request parameters or steps' }, { status: 400 });
        }

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

            // Create step records
            const stepRecords = steps.map((s: { stepNumber: number; roleRequired: string; assignedUserId?: string }) => ({
                requestId: req.id,
                stepNumber: s.stepNumber,
                roleRequired: s.roleRequired,
                assignedUserId: s.assignedUserId || null,
                status: 'PENDING'
            }));

            await tx.projectApprovalStep.createMany({
                data: stepRecords
            });

            // Update source status to UNDER_REVIEW
            if (type === 'DOCUMENT') {
                await tx.projectDocument.update({
                    where: { id: referenceId },
                    data: { status: 'UNDER_REVIEW' }
                });
            }

            return req;
        });

        // After transaction: notify first step assignee(s) - non-blocking
        (async () => {
            try {
                const firstSteps = (steps as Array<{ stepNumber: number; assignedUserId?: string; roleRequired: string }>).filter(s => s.stepNumber === 1);

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

        return NextResponse.json(newRequest);
    } catch (error) {
        console.error('Error creating approval request:', error);
        return NextResponse.json({ error: 'Failed to create approval request' }, { status: 500 });
    }
}

// PATCH: Approve or Reject a step
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: projectId } = await params;
        const body = await request.json();
        const { stepId, action, comment, actionedById } = body; // Action: APPROVED, REJECTED

        if (!stepId || !action || !actionedById) {
            return NextResponse.json({ error: 'stepId, action, and actionedById are required' }, { status: 400 });
        }

        const step = await prisma.projectApprovalStep.findUnique({
            where: { id: stepId },
            include: { request: true }
        });

        if (!step) {
            return NextResponse.json({ error: 'Approval step not found' }, { status: 404 });
        }

        const currentStepNumber = step.stepNumber;

        const updatedRequest = await prisma.$transaction(async (tx) => {
            // 1. Update the current step
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

            // Re-evaluate current step as approved in memory (DB write above is in-tx)
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

            // 2. Update Request Status if finished or rejected
            if (finalStatus !== 'PENDING') {
                await tx.projectApprovalRequest.update({
                    where: { id: step.requestId },
                    data: { status: finalStatus }
                });

                // 3. Propagate status back to the source entity (e.g. ProjectDocument)
                if (step.request.type === 'DOCUMENT') {
                    await tx.projectDocument.update({
                        where: { id: step.request.referenceId },
                        data: { status: finalStatus }
                    });
                }
            }

            // Return updated request with steps
            return await tx.projectApprovalRequest.findUnique({
                where: { id: step.requestId },
                include: { steps: { orderBy: { stepNumber: 'asc' } } }
            });
        });

        // After transaction: fire notifications asynchronously - non-blocking
        (async () => {
            try {
                const requestTitle = step.request.title;
                const approvalLink = `/projects/${projectId}/approvals`;

                // Fetch project info for creator notification
                const project = await prisma.project.findUnique({
                    where: { id: projectId },
                    select: { areaManagerId: true, name: true }
                });

                if (action === 'REJECTED') {
                    // Notify project creator
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
                    // Also broadcast to managers
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
                    const allApproved = allSteps.every((s: { status: string }) => s.status === 'APPROVED');

                    if (allApproved) {
                        // Notify project creator that all steps are done
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
                        // Broadcast to OSP/Admin
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
                        // Unlock next step — notify next step assignee
                        const nextStep = (updatedRequest?.steps || []).find(
                            (s: { stepNumber: number; status: string }) =>
                                s.stepNumber === currentStepNumber + 1
                        ) as { assignedUserId?: string | null; roleRequired: string; stepNumber: number } | undefined;

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

        return NextResponse.json(updatedRequest);
    } catch (error) {
        console.error('Error actioning approval step:', error);
        return NextResponse.json({ error: 'Failed to process approval step' }, { status: 500 });
    }
}
