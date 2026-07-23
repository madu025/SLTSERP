import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { PreErpReconciliationService } from '@/services/inventory/pre-erp-reconciliation.service';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const ApproveSchema = z.object({
  adjustmentId: z.string().min(1),
  action: z.enum(['APPROVE', 'REJECT']),
  rejectionReason: z.string().optional(),
});

export const POST = apiHandler(async (req, _params, body) => {
  const userId = req.headers.get('x-user-id');
  if (!userId) throw AppError.unauthorized('Authentication required');

  if (body.action === 'APPROVE') {
    const result = await PreErpReconciliationService.approveAdjustment(
      body.adjustmentId,
      userId
    );
    return { success: true, message: 'Adjustment approved & ERP stock updated', data: result };
  } else {
    if (!body.rejectionReason) throw AppError.badRequest('rejectionReason required for REJECT action');
    const result = await PreErpReconciliationService.rejectAdjustment(
      body.adjustmentId,
      userId,
      body.rejectionReason
    );
    return { success: true, message: 'Adjustment rejected', data: result };
  }
}, {
  schema: ApproveSchema,
  roles: ['SUPER_ADMIN', 'ADMIN', 'STORES_MANAGER', 'FINANCE_MANAGER'],
  audit: { action: 'APPROVE_ADJUSTMENT', entity: 'MATERIAL_VARIANCE_ADJUSTMENT' },
  rawResponse: true,
});
