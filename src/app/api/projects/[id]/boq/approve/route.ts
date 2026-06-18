import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

type Params = Promise<{ id: string }>;

// GET /api/projects/[id]/boq/approve - Get BOQ approval status
export async function GET(_request: Request, { params }: { params: Params }) {
  try {
    const { id: projectId } = await params;
    const userId = _request.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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

    return NextResponse.json({
      approval: approval || { status: 'NOT_GENERATED', message: 'BOQ not yet generated' },
      boqItems,
      summary: {
        categories: categoryTotals,
        totalItems: boqItems.length,
        grandTotal,
      },
    });
  } catch (error) {
    console.error('Error fetching BOQ approval:', error);
    return NextResponse.json({ error: 'Failed to fetch BOQ approval' }, { status: 500 });
  }
}

// POST /api/projects/[id]/boq/approve - Submit BOQ for approval or approve/reject
export async function POST(request: Request, { params }: { params: Params }) {
  try {
    const { id: projectId } = await params;
    const userId = request.headers.get('x-user-id');
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { action, notes } = body;

    // ── Action: SUBMIT for approval ─────────────────────────────────────
    if (action === 'submit') {
      // Verify BOQ was generated
      const boqCount = await prisma.projectBOQItem.count({ where: { projectId } });
      if (boqCount === 0) {
        return NextResponse.json(
          { error: 'No BOQ items found. Generate BOQ first via POST /api/projects/{id}/boq/generate' },
          { status: 400 }
        );
      }

      // Check for existing pending approval
      const existing = await prisma.bOQApproval.findFirst({
        where: {
          projectId,
          status: { in: ['PENDING', 'APPROVED'] },
        },
      });

      if (existing) {
        return NextResponse.json(
          { error: `BOQ is already ${existing.status}. Revise or reject first before resubmitting.` },
          { status: 409 }
        );
      }

      const approval = await prisma.bOQApproval.create({
        data: {
          boqId: projectId, // Use projectId as BOQ reference
          projectId,
          status: 'PENDING',
          currentStep: 'SUPERVISOR',
          notes: notes || null,
        },
      });

      // Update project status
      await prisma.project.update({
        where: { id: projectId },
        data: { status: 'BOQ_PENDING' },
      });

      return NextResponse.json(
        { message: 'BOQ submitted for approval', approval },
        { status: 201 }
      );
    }

    // ── Action: APPROVE ──────────────────────────────────────────────────
    if (action === 'approve') {
      const approval = await prisma.bOQApproval.findFirst({
        where: { projectId, status: 'PENDING' },
      });

      if (!approval) {
        return NextResponse.json({ error: 'No pending BOQ approval found' }, { status: 404 });
      }

      // Determine which approval step this is
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

      // If fully approved, set budget
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

      return NextResponse.json({
        message: `BOQ step ${step} approved`,
        approval: updated,
        nextStep: updated.status === 'APPROVED' ? null : updated.currentStep,
      });
    }

    // ── Action: REJECT ───────────────────────────────────────────────────
    if (action === 'reject') {
      if (!notes) {
        return NextResponse.json(
          { error: 'Notes are required when rejecting BOQ' },
          { status: 400 }
        );
      }

      const approval = await prisma.bOQApproval.findFirst({
        where: { projectId, status: 'PENDING' },
      });

      if (!approval) {
        return NextResponse.json({ error: 'No pending BOQ approval found' }, { status: 404 });
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

      return NextResponse.json({ message: 'BOQ rejected', approval: updated });
    }

    // ── Action: REVISE ───────────────────────────────────────────────────
    if (action === 'revise') {
      const approval = await prisma.bOQApproval.findFirst({
        where: { projectId, status: 'REJECTED' },
      });

      if (!approval) {
        return NextResponse.json(
          { error: 'No rejected BOQ found to revise. Re-generate BOQ first if needed.' },
          { status: 404 }
        );
      }

      // Re-generate BOQ and re-submit
      const { AutoBOQService } = await import('@/services/auto-boq.service');
      const { boq } = await AutoBOQService.generateBOQ(projectId);

      if (!boq.length) {
        return NextResponse.json(
          { error: 'No approved survey points found for BOQ generation' },
          { status: 400 }
        );
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

      return NextResponse.json(
        { message: 'BOQ revised and resubmitted', approval: newApproval, boq },
        { status: 201 }
      );
    }

    return NextResponse.json(
      { error: 'Invalid action. Use: submit, approve, reject, revise' },
      { status: 400 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'BOQ approval failed';
    console.error('BOQ approval error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}