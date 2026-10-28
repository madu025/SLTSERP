import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { ProjectContractorAssignmentService } from '@/services/project/project-contractor-assignment.service';
import { assertProjectAccess } from '@/lib/project-access';
import { prisma } from '@/lib/prisma';
import { databaseUuidSchema } from '@/lib/validations/uuid.schema';
import { z } from 'zod';

const assignmentSchema = z.object({
  projectId: databaseUuidSchema,
  contractorId: databaseUuidSchema,
  role: z.string().trim().min(1).max(80).optional(),
  allocationPercent: z.number().finite().positive().max(100).nullable().optional(),
  contractValue: z.number().finite().nonnegative().nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
});

export const GET = apiHandler(async (request) => {
  const projectId = new URL(request.url).searchParams.get('projectId');
  if (!projectId) throw AppError.badRequest('projectId is required');
  await assertProjectAccess(projectId, request.headers.get('x-user-id'));
  return ProjectContractorAssignmentService.list(projectId);
}, { permissions: [RBAC_PERMISSIONS.PROJECT_READ], rawResponse: true });

export const POST = apiHandler(async (_request, params, body: z.infer<typeof assignmentSchema>) => {
  await assertProjectAccess(body.projectId, params._userId);
  return ProjectContractorAssignmentService.assign(body);
}, {
  schema: assignmentSchema,
  permissions: [RBAC_PERMISSIONS.PROJECT_WRITE],
  audit: { action: 'CREATE', entity: 'PROJECT_CONTRACTOR_ASSIGNMENT' },
  rawResponse: true,
});

const assignmentActionSchema = z.object({
  id: databaseUuidSchema,
  action: z.enum(['RELEASE', 'REPLACE']),
  replacementContractorId: databaseUuidSchema.optional(),
});

export const PATCH = apiHandler(async (_request, params, body: z.infer<typeof assignmentActionSchema>) => {
  const assignment = await prisma.projectContractorAssignment.findUnique({
    where: { id: body.id },
    select: { projectId: true },
  });
  if (!assignment) throw AppError.notFound('CONTRACTOR_ASSIGNMENT_NOT_FOUND');
  await assertProjectAccess(assignment.projectId, params._userId);
  if (body.action === 'REPLACE') {
    if (!body.replacementContractorId) throw AppError.badRequest('replacementContractorId is required');
    return ProjectContractorAssignmentService.replace(body.id, body.replacementContractorId);
  }
  return ProjectContractorAssignmentService.release(body.id);
}, {
  schema: assignmentActionSchema,
  permissions: [RBAC_PERMISSIONS.PROJECT_WRITE],
  audit: { action: 'RELEASE', entity: 'PROJECT_CONTRACTOR_ASSIGNMENT' },
  rawResponse: true,
});
