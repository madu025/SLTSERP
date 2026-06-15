import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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
                status: s.stepNumber === 1 ? 'PENDING' : 'PENDING' // Future steps can also default to pending
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

            let finalStatus = 'PENDING';

            if (action === 'REJECTED') {
                finalStatus = 'REJECTED';
            } else {
                // Check if all steps are approved
                const allApproved = allSteps.every(s => s.status === 'APPROVED');
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
                include: { steps: true }
            });
        });

        return NextResponse.json(updatedRequest);
    } catch (error) {
        console.error('Error actioning approval step:', error);
        return NextResponse.json({ error: 'Failed to process approval step' }, { status: 500 });
    }
}
