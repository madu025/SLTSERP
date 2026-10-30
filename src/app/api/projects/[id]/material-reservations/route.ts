import { z } from 'zod';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { ProjectMaterialReservationService } from '@/services/project/project-material-reservation.service';
import { assertProjectAccess } from '@/lib/project-access';
import { StoreService } from '@/services/inventory/store.service';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const reservationSchema = z.object({
  action: z.enum(['SYNC_REQUIREMENTS', 'RESERVE', 'RELEASE']),
  storeId: z.string().uuid().optional(),
  reservationId: z.string().uuid().optional(),
  requirementIds: z.array(z.string().uuid()).max(500).optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
});

async function scopeAvailability<T extends { availability: Array<{ storeId: string }> }>(overview: T[], userId: string) {
  const stores = await StoreService.getAccessibleStores(userId, '');
  const allowedStores = new Set(stores.map((store) => store.id));
  return overview.map((requirement) => ({
    ...requirement,
    availability: requirement.availability.filter((stock) => allowedStores.has(stock.storeId)),
  }));
}

export const GET = apiHandler(async (_request, params) => {
  await assertProjectAccess(params.id, params._userId);
  return scopeAvailability(await ProjectMaterialReservationService.getOverview(params.id), params._userId!);
}, { permissions: [RBAC_PERMISSIONS.PROJECT_READ], rawResponse: true });

export const POST = apiHandler(async (_request, params, body: z.infer<typeof reservationSchema>) => {
  const userId = params._userId;
  if (!userId) throw AppError.unauthorized('Authenticated material actor is required');
  await assertProjectAccess(params.id, userId);

  if (body.action === 'SYNC_REQUIREMENTS') {
    return scopeAvailability(await ProjectMaterialReservationService.syncForProject(params.id), userId);
  }
  if (body.action === 'RESERVE') {
    if (!body.storeId) throw AppError.badRequest('storeId is required for reservation');
    await StoreService.assertStoreWriteAccess(userId, body.storeId);
    return ProjectMaterialReservationService.reserve({
      projectId: params.id,
      storeId: body.storeId,
      userId,
      requirementIds: body.requirementIds,
      notes: body.notes,
    });
  }
  if (!body.reservationId) throw AppError.badRequest('reservationId is required for release');
  const reservation = await prisma.projectMaterialReservation.findUnique({ where: { id: body.reservationId }, select: { projectId: true, storeId: true } });
  if (!reservation || reservation.projectId !== params.id) throw AppError.notFound('Reservation not found');
  await StoreService.assertStoreWriteAccess(userId, reservation.storeId);
  return ProjectMaterialReservationService.release(body.reservationId, userId);
}, {
  schema: reservationSchema,
  permissions: [RBAC_PERMISSIONS.INVENTORY_WRITE],
  audit: { action: 'PROJECT_MATERIAL_RESERVATION', entity: 'PROJECT_MATERIAL_RESERVATION' },
  rawResponse: true,
});
