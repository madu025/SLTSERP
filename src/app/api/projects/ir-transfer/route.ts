export const dynamic = 'force-dynamic';
import { assertProjectAccess } from '@/lib/project-access';
import { requireUserId } from '@/lib/project-record-access';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { apiHandler } from '@/lib/api-handler';
import { ProjectIRLedgerService } from '@/services/project/project-ir-ledger.service';
import { z } from 'zod';

const transferSchema = z.object({
  sourceProjectId: z.string().min(1), destProjectId: z.string().min(1),
  storeId: z.string().min(1), batchId: z.string().min(1), itemId: z.string().min(1),
  quantity: z.number().positive(), remarks: z.string().optional(),
});

// POST: Record a project-to-project material transfer
export const POST = apiHandler(async (_req, params, body) => {
  const userId = requireUserId(params._userId);
  const { sourceProjectId, destProjectId } = (body || {}) as { sourceProjectId?: string; destProjectId?: string };
  if (!sourceProjectId || !destProjectId) throw AppError.badRequest('sourceProjectId and destProjectId are required');
  await assertProjectAccess(sourceProjectId, userId);
  await assertProjectAccess(destProjectId, userId);

  const result = await ProjectIRLedgerService.recordProjectTransfer({
    ...transferSchema.parse(body),
    userId
  });
  return result;
}, {
  permissions: [RBAC_PERMISSIONS.INVENTORY_WRITE],
  audit: { action: 'CREATE', entity: 'STOCK_MOVEMENT' }
});
