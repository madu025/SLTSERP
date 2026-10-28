import { AppError } from '@/lib/error';
import { prisma } from '@/lib/prisma';
import { ROLE_GROUPS } from '@/config/roles';

const ACTIVE_REVIEW_STATUSES = ['DRAFT', 'IN_REVIEW'];
const REVIEW_DECISIONS = ['APPROVED', 'CHANGES_REQUESTED', 'REJECTED'] as const;

type ReviewDecision = typeof REVIEW_DECISIONS[number];

export class ProjectWorkflowReviewService {
  static async list(projectId: string, stageId?: string) {
    return prisma.workflowReviewCycle.findMany({
      where: { projectId, ...(stageId ? { stageId } : {}) },
      include: {
        comments: { orderBy: { createdAt: 'asc' } },
        stage: { select: { id: true, code: true, name: true, sequence: true, status: true, revision: true } },
      },
      orderBy: [{ stageId: 'asc' }, { revision: 'desc' }],
    });
  }

  private static async getStage(projectId: string, stageId: string) {
    const stage = await prisma.projectStageInstance.findFirst({
      where: { id: stageId, projectWorkflowInstance: { projectId } },
      include: {
        projectWorkflowInstance: { select: { projectId: true } },
        approvals: true,
      },
    });
    if (!stage) throw AppError.notFound('Workflow stage not found for this project');
    return stage;
  }

  static async submit(input: {
    projectId: string;
    stageId: string;
    deliverableType?: string;
    reviewerRole?: string;
    submittedById: string;
    notes?: string;
  }) {
    const stage = await this.getStage(input.projectId, input.stageId);
    if (!['IN_PROGRESS', 'CHANGES_REQUESTED'].includes(stage.status)) {
      throw AppError.badRequest('Only an active or rework-requested stage can be submitted for review');
    }

    const activeReview = await prisma.workflowReviewCycle.findFirst({
      where: { stageId: input.stageId, status: { in: ACTIVE_REVIEW_STATUSES } },
      select: { id: true },
    });
    if (activeReview) throw AppError.conflict('This stage already has an active review cycle');

    const latest = await prisma.workflowReviewCycle.findFirst({
      where: { stageId: input.stageId },
      orderBy: { revision: 'desc' },
      select: { revision: true },
    });
    const revision = (latest?.revision ?? 0) + 1;
    const reviewerRole = input.reviewerRole || stage.assignedRole || stage.approvals[0]?.role || null;

    return prisma.$transaction(async (tx) => {
      const review = await tx.workflowReviewCycle.create({
        data: {
          projectId: input.projectId,
          stageId: input.stageId,
          deliverableType: input.deliverableType || stage.code || stage.name,
          revision,
          status: 'IN_REVIEW',
          submittedById: input.submittedById,
          reviewerRole,
          submittedAt: new Date(),
          decisionNotes: input.notes || null,
        },
        include: { comments: true },
      });

      await tx.projectStageInstance.update({
        where: { id: stage.id },
        data: {
          status: 'IN_REVIEW',
          reviewStatus: 'IN_REVIEW',
          revision,
        },
      });

      await tx.workflowAuditLog.create({
        data: {
          userId: input.submittedById,
          action: 'WORKFLOW_REVIEW_SUBMITTED',
          entityType: 'WorkflowReviewCycle',
          entityId: review.id,
          details: { projectId: input.projectId, stageId: stage.id, revision, deliverableType: review.deliverableType },
        },
      });

      return review;
    });
  }

  static async decide(input: {
    projectId: string;
    reviewId: string;
    decision: ReviewDecision;
    reviewerUserId: string;
    reviewerRole?: string;
    notes?: string;
    comments?: Array<{ comment: string; severity?: string }>;
  }) {
    if (!REVIEW_DECISIONS.includes(input.decision)) {
      throw AppError.badRequest('Review decision must be APPROVED, CHANGES_REQUESTED, or REJECTED');
    }

    const review = await prisma.workflowReviewCycle.findFirst({
      where: { id: input.reviewId, projectId: input.projectId },
      include: { stage: true },
    });
    if (!review) throw AppError.notFound('Workflow review not found for this project');
    if (review.status !== 'IN_REVIEW') throw AppError.badRequest('This review cycle has already been actioned');

    const role = input.reviewerRole || '';
    const isAdmin = ROLE_GROUPS.ADMINS.includes(role as never);
    if (!isAdmin && review.reviewerRole && review.reviewerRole !== role) {
      throw AppError.forbidden(`This review requires the ${review.reviewerRole} role`);
    }

    const nextStageStatus = input.decision === 'CHANGES_REQUESTED' ? 'CHANGES_REQUESTED' : 'IN_PROGRESS';
    const nextReviewStatus = input.decision === 'APPROVED' ? 'APPROVED' : 'CHANGES_REQUESTED';

    return prisma.$transaction(async (tx) => {
      const updated = await tx.workflowReviewCycle.update({
        where: { id: review.id },
        data: {
          status: input.decision,
          reviewerUserId: input.reviewerUserId,
          reviewedAt: new Date(),
          decisionNotes: input.notes || null,
          comments: input.comments?.length
            ? { create: input.comments.map((item) => ({ comment: item.comment, severity: item.severity || 'REQUIRED' })) }
            : undefined,
        },
        include: { comments: true },
      });

      await tx.projectStageInstance.update({
        where: { id: review.stageId },
        data: {
          status: nextStageStatus,
          reviewStatus: nextReviewStatus,
          reworkCount: input.decision === 'CHANGES_REQUESTED' ? { increment: 1 } : undefined,
        },
      });

      if (input.decision === 'APPROVED') {
        const nextStage = await tx.projectStageInstance.findFirst({
          where: { projectWorkflowInstanceId: review.stage.projectWorkflowInstanceId, sequence: review.stage.sequence + 1 },
          select: { id: true, name: true },
        });
        if (nextStage) {
          await tx.workflowHandoff.create({
            data: {
              projectId: input.projectId,
              fromStageId: review.stageId,
              toStageId: nextStage.id,
              deliverableType: review.deliverableType,
              status: 'READY',
              acceptedById: null,
              notes: `Review revision ${review.revision} approved; ready for handoff to ${nextStage.name}`,
            },
          });
        }
      }

      await tx.workflowAuditLog.create({
        data: {
          userId: input.reviewerUserId,
          action: `WORKFLOW_REVIEW_${input.decision}`,
          entityType: 'WorkflowReviewCycle',
          entityId: review.id,
          details: { projectId: input.projectId, stageId: review.stageId, revision: review.revision, notes: input.notes || null },
        },
      });

      return updated;
    });
  }

  static async listHandoffs(projectId: string) {
    return prisma.workflowHandoff.findMany({
      where: { projectId },
      include: {
        fromStage: { select: { id: true, code: true, name: true, sequence: true } },
        toStage: { select: { id: true, code: true, name: true, sequence: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async acceptHandoff(input: { projectId: string; handoffId: string; userId: string; notes?: string }) {
    const handoff = await prisma.workflowHandoff.findFirst({
      where: { id: input.handoffId, projectId: input.projectId },
      select: { id: true, status: true },
    });
    if (!handoff) throw AppError.notFound('Workflow handoff not found for this project');
    if (handoff.status !== 'READY') throw AppError.badRequest('Only a READY workflow handoff can be accepted');

    return prisma.$transaction(async (tx) => {
      const accepted = await tx.workflowHandoff.update({
        where: { id: input.handoffId },
        data: { status: 'ACCEPTED', acceptedById: input.userId, acceptedAt: new Date(), notes: input.notes || undefined },
      });
      await tx.workflowAuditLog.create({
        data: {
          userId: input.userId,
          action: 'WORKFLOW_HANDOFF_ACCEPTED',
          entityType: 'WorkflowHandoff',
          entityId: input.handoffId,
          details: { projectId: input.projectId },
        },
      });
      return accepted;
    });
  }
}
