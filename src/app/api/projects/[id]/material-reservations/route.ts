import { z } from 'zod';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { ProjectMaterialReservationService } from '@/services/project/project-material-reservation.service';

export const dynamic = 'force-dynamic';

const reservationSchema = z.object({
  action: z.enum(['SYNC_REQUIREMENTS', 'RESERVE', 'RELEASE']),
  storeId: z.string().uuid().optional(),
  reservationId: z.string().uuid().optional(),
  requirementIds: z.array(z.string().uuid()).max(500).optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
});

export const GET = apiHandler(async (_request, params) => {
  return ProjectMaterialReservationService.getOverview(params.id);
}, { permissions: [RBAC_PERMISSIONS.PROJECT_READ], rawResponse: true });

export const POST = apiHandler(async (_request, params, body: z.infer<typeof reservationSchema>) => {
  const userId = params._userId;
  if (!userId) throw AppError.unauthorized('Authenticated material actor is required');

  if (body.action === 'SYNC_REQUIREMENTS') {
    return ProjectMaterialReservationService.syncForProject(params.id);
  }
  if (body.action === 'RESERVE') {
    if (!body.storeId) throw AppError.badRequest('storeId is required for reservation');
    return ProjectMaterialReservationService.reserve({
      projectId: params.id,
      storeId: body.storeId,
      userId,
      requirementIds: body.requirementIds,
      notes: body.notes,
    });
  }
  if (!body.reservationId) throw AppError.badRequest('reservationId is required for release');
  return ProjectMaterialReservationService.release(body.reservationId, userId);
}, {
  schema: reservationSchema,
  permissions: [RBAC_PERMISSIONS.INVENTORY_WRITE],
  audit: { action: 'PROJECT_MATERIAL_RESERVATION', entity: 'PROJECT_MATERIAL_RESERVATION' },
  rawResponse: true,
});
