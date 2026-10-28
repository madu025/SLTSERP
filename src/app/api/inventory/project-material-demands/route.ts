import { z } from 'zod';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { ProjectMaterialDemandService } from '@/services/inventory/project-material-demand.service';

export const dynamic = 'force-dynamic';

const actionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('SYNC'),
    projectId: z.string().uuid(),
  }),
  z.object({
    action: z.literal('RESERVE_AVAILABLE'),
    projectId: z.string().uuid(),
    storeId: z.string().uuid(),
    requirementIds: z.array(z.string().uuid()).optional(),
    notes: z.string().max(500).optional(),
  }),
  z.object({
    action: z.literal('CREATE_SOURCE_REQUEST'),
    requirementId: z.string().uuid(),
    sourceType: z.enum(['SLT', 'LOCAL_PURCHASE']),
    storeId: z.string().uuid(),
    requestedQty: z.number().positive().optional(),
    requiredDate: z.string().datetime().optional(),
    notes: z.string().max(500).optional(),
  }),
]);

export const GET = apiHandler(async (request, params) => {
  const { searchParams } = new URL(request.url);
  return ProjectMaterialDemandService.getBoard({
    userId: params._userId ?? '',
    projectId: searchParams.get('projectId') || undefined,
    sourceType: searchParams.get('sourceType') || undefined,
    status: searchParams.get('status') || undefined,
  });
}, {
  permissions: [RBAC_PERMISSIONS.INVENTORY_READ],
  rawResponse: true,
});

export const POST = apiHandler(async (_request, params, body) => {
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) throw AppError.badRequest('INVALID_PROJECT_MATERIAL_ACTION');
  if (!params._userId) throw AppError.unauthorized('Authentication required');

  if (parsed.data.action === 'SYNC') {
    return ProjectMaterialDemandService.syncProject(parsed.data.projectId, params._userId);
  }

  if (parsed.data.action === 'RESERVE_AVAILABLE') {
    return ProjectMaterialDemandService.reserveAvailable({
      ...parsed.data,
      userId: params._userId,
    });
  }

  return ProjectMaterialDemandService.createSourceAllocation({
    ...parsed.data,
    userId: params._userId,
  });
}, {
  permissions: [RBAC_PERMISSIONS.INVENTORY_WRITE],
  rawResponse: true,
  audit: { action: 'UPDATE', entity: 'PROJECT_MATERIAL_DEMAND' },
});
