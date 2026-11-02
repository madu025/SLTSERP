import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { PreErpReconciliationService } from '@/services/inventory/pre-erp-reconciliation.service';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const AdjustSchema = z.object({
  balanceId: z.string().min(1),
  physicalAuditedQty: z.number().min(0),
  varianceReason: z.enum(['UNRECORDED_RECEIPT', 'BUFFER_STOCK', 'FIELD_SCRAP', 'OTHER']),
});

export const POST = apiHandler(async (_req, params, body) => {
  const userId = params._userId;
  if (!userId) throw AppError.unauthorized('Authentication required');

  const result = await PreErpReconciliationService.submitVarianceAdjustment({
    ...body,
    createdById: userId,
  });

  return { success: true, data: result };
}, {
  schema: AdjustSchema,
  permissions: [RBAC_PERMISSIONS.INVENTORY_WRITE],
  audit: { action: 'SUBMIT_ADJUSTMENT', entity: 'MATERIAL_VARIANCE_ADJUSTMENT' },
  rawResponse: true,
});
