export const dynamic = 'force-dynamic';
import { AppError } from '@/lib/error';
import { assertProjectAccess } from '@/lib/project-access';
import { requireUserId } from '@/lib/project-record-access';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { apiHandler } from '@/lib/api-handler';
import { ProjectIRLedgerService } from '@/services/project/project-ir-ledger.service';
import { z } from 'zod';

const wastageSchema = z.object({
  projectId: z.string().min(1), storeId: z.string().min(1), batchId: z.string().min(1),
  itemId: z.string().min(1), quantity: z.number().positive(),
  remarks: z.string().optional(), contractorId: z.string().optional(),
});

// POST: Record project material wastage
export const POST = apiHandler(async (_req, params, body) => {
  const userId = requireUserId(params._userId);
  const { projectId } = (body || {}) as { projectId?: string };
  if (!projectId) throw AppError.badRequest('projectId is required');
  await assertProjectAccess(projectId, userId);

  const result = await ProjectIRLedgerService.recordWastage({
    ...wastageSchema.parse(body),
    userId
  });
  return result;
}, {
  permissions: [RBAC_PERMISSIONS.INVENTORY_WRITE],
  audit: { action: 'CREATE', entity: 'WASTAGE' }
});
