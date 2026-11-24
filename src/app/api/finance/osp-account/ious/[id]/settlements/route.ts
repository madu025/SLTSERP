import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { OspFloatService } from '@/services/finance/osp-float.service';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const settlementSchema = z.object({
  kind: z.enum(['BILLS', 'REFUND', 'REMINDER']),
  amount: z.number().finite().nonnegative().optional(),
  reference: z.string().trim().max(120).optional(),
  settleDate: z.string().optional(),
  remarks: z.string().trim().max(2000).optional(),
}).strict();

// POST: bills handed in, cash returned, or a follow-up reminder on an issued IOU
export const POST = apiHandler(async (_req, params, body) => {
  if (!params._userId) throw AppError.unauthorized('Authentication required');
  return { message: 'Recorded', data: await OspFloatService.recordSettlement(params._userId, params.id, body) };
}, { schema: settlementSchema, audit: { action: 'SETTLE', entity: 'OSP_IOU' } });
