import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { ProjectContractorAssignmentService } from '@/services/project/project-contractor-assignment.service';
import { z } from 'zod';

const assignmentSchema = z.object({
  projectId: z.string().uuid(),
  contractorId: z.string().uuid(),
  role: z.string().trim().min(1).max(80).optional(),
  allocationPercent: z.number().finite().positive().max(100).nullable().optional(),
  contractValue: z.number().finite().nonnegative().nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
});

export const GET = apiHandler(async (request) => {
  const projectId = new URL(request.url).searchParams.get('projectId');
  if (!projectId) throw AppError.badRequest('projectId is required');
  return ProjectContractorAssignmentService.list(projectId);
}, { permissions: [RBAC_PERMISSIONS.PROJECT_READ], rawResponse: true });

export const POST = apiHandler(async (_request, _params, body: z.infer<typeof assignmentSchema>) => {
  return ProjectContractorAssignmentService.assign(body);
}, {
  schema: assignmentSchema,
  permissions: [RBAC_PERMISSIONS.PROJECT_WRITE],
  audit: { action: 'CREATE', entity: 'PROJECT_CONTRACTOR_ASSIGNMENT' },
  rawResponse: true,
});

const assignmentActionSchema = z.object({
  id: z.string().uuid(),
  action: z.enum(['RELEASE', 'REPLACE']),
  replacementContractorId: z.string().uuid().optional(),
});

export const PATCH = apiHandler(async (_request, _params, body: z.infer<typeof assignmentActionSchema>) => {
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
