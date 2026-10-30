import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { assertProjectAccess } from '@/lib/project-access';
import { ProjectFinanceAssignmentService } from '@/services/project/project-finance-assignment.service';
import { databaseUuidSchema } from '@/lib/validations/uuid.schema';
import { z } from 'zod';
import { userHasPermission } from '@/lib/user-permissions';

export const dynamic = 'force-dynamic';

const assignmentSchema = z.object({
  projectId: databaseUuidSchema,
  userId: databaseUuidSchema,
  assignmentRole: z.enum(['LEAD_CONTROLLER', 'PREPARER', 'REVIEWER', 'APPROVER']),
  isPrimary: z.boolean().optional(),
  startsAt: z.string().datetime().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
});

const updateSchema = z.object({
  id: databaseUuidSchema,
  status: z.enum(['ACTIVE', 'ENDED']),
  isPrimary: z.boolean().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
});

export const GET = apiHandler(async (request, params) => {
  const projectId = new URL(request.url).searchParams.get('projectId');
  if (!projectId) throw AppError.badRequest('projectId is required');
  await assertProjectAccess(projectId, params._userId);
  const includeCandidates = new URL(request.url).searchParams.get('includeCandidates') === 'true';
  if (includeCandidates && !await userHasPermission(params._userId, RBAC_PERMISSIONS.PROJECT_FINANCE_ASSIGN)) {
    return ProjectFinanceAssignmentService.list(projectId, false);
  }
  return ProjectFinanceAssignmentService.list(projectId, includeCandidates);
}, { permissions: [RBAC_PERMISSIONS.PROJECT_FINANCE_READ], rawResponse: true });

export const POST = apiHandler(async (_request, params, body: z.infer<typeof assignmentSchema>) => {
  await assertProjectAccess(body.projectId, params._userId);
  if (!params._userId) throw AppError.unauthorized('Authentication required');
  return ProjectFinanceAssignmentService.assign({ ...body, assignedById: params._userId });
}, {
  schema: assignmentSchema,
  permissions: [RBAC_PERMISSIONS.PROJECT_FINANCE_ASSIGN],
  audit: { action: 'CREATE', entity: 'PROJECT_FINANCE_ASSIGNMENT' },
  rawResponse: true,
});

export const PATCH = apiHandler(async (_request, params, body: z.infer<typeof updateSchema>) => {
  if (!params._userId) throw AppError.unauthorized('Authentication required');
  return ProjectFinanceAssignmentService.update({ ...body, actorId: params._userId });
}, {
  schema: updateSchema,
  permissions: [RBAC_PERMISSIONS.PROJECT_FINANCE_ASSIGN],
  audit: { action: 'UPDATE', entity: 'PROJECT_FINANCE_ASSIGNMENT' },
  rawResponse: true,
});
