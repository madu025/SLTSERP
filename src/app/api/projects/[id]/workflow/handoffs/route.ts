import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { ProjectWorkflowReviewService } from '@/services/project/project-workflow-review.service';
import { assertProjectAccess } from '@/lib/project-access';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (_request, params) => {
  await assertProjectAccess(params.id, params._userId);
  return ProjectWorkflowReviewService.listHandoffs(params.id);
}, { permissions: [RBAC_PERMISSIONS.PROJECT_READ], rawResponse: true });

export const POST = apiHandler(async (_request, params, body) => {
  const handoffId = body.handoffId as string | undefined;
  if (!handoffId || !params._userId) throw AppError.badRequest('handoffId and authenticated session are required');
  await assertProjectAccess(params.id, params._userId);
  return ProjectWorkflowReviewService.acceptHandoff({
    projectId: params.id,
    handoffId,
    userId: params._userId,
    notes: typeof body.notes === 'string' ? body.notes : undefined,
  });
}, {
  permissions: [RBAC_PERMISSIONS.PROJECT_WRITE],
  audit: { action: 'ACCEPT_WORKFLOW_HANDOFF', entity: 'WORKFLOW_HANDOFF' },
  rawResponse: true,
});
