import { z } from 'zod';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { ProjectWorkflowReviewService } from '@/services/project/project-workflow-review.service';
import { assertProjectAccess } from '@/lib/project-access';

export const dynamic = 'force-dynamic';

const reviewCommentSchema = z.object({
  comment: z.string().trim().min(2),
  severity: z.string().trim().min(2).optional(),
});

const reviewSchema = z.object({
  action: z.enum(['submit', 'decide', 'resubmit']),
  stageId: z.string().uuid().optional(),
  reviewId: z.string().uuid().optional(),
  deliverableType: z.string().trim().min(2).optional(),
  reviewerRole: z.string().trim().min(2).optional(),
  decision: z.enum(['APPROVED', 'CHANGES_REQUESTED', 'REJECTED']).optional(),
  notes: z.string().trim().max(4000).optional().nullable(),
  comments: z.array(reviewCommentSchema).optional(),
});

export const GET = apiHandler(async (request, params) => {
  await assertProjectAccess(params.id, params._userId);
  const { searchParams } = new URL(request.url);
  const stageId = searchParams.get('stageId') || undefined;
  return {
    reviews: await ProjectWorkflowReviewService.list(params.id, stageId),
    handoffs: await ProjectWorkflowReviewService.listHandoffs(params.id),
  };
}, { permissions: [RBAC_PERMISSIONS.PROJECT_READ], rawResponse: true });

export const POST = apiHandler(async (_request, params, body) => {
  const input = reviewSchema.parse(body);
  const actorId = params._userId;
  if (!actorId) throw AppError.unauthorized('Authenticated session is required');
  await assertProjectAccess(params.id, actorId);

  if (input.action === 'submit' || input.action === 'resubmit') {
    if (!input.stageId) throw AppError.badRequest('stageId is required');
    return ProjectWorkflowReviewService.submit({
      projectId: params.id,
      stageId: input.stageId,
      deliverableType: input.deliverableType,
      reviewerRole: input.reviewerRole,
      submittedById: actorId,
      notes: input.notes || undefined,
    });
  }

  if (!input.reviewId || !input.decision) {
    throw AppError.badRequest('reviewId and decision are required');
  }

  return ProjectWorkflowReviewService.decide({
    projectId: params.id,
    reviewId: input.reviewId,
    decision: input.decision,
    reviewerUserId: actorId,
    reviewerRole: params._userRole || undefined,
    notes: input.notes || undefined,
    comments: input.comments,
  });
}, {
  permissions: [RBAC_PERMISSIONS.PROJECT_WRITE],
  audit: { action: 'WORKFLOW_REVIEW', entity: 'WORKFLOW_REVIEW' },
  rawResponse: true,
});
