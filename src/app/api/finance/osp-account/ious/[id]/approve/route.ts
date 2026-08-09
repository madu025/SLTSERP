import { apiHandler } from '@/lib/api-handler';
import { OSPAccountCrudService } from '@/services/finance/osp-account-crud.service';
import { ROLE_GROUPS } from '@/config/roles';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const actionSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT']),
  reason: z.string().optional(),
});

export const PATCH = apiHandler(async (_request, params, body) => {
  const { action, reason } = body;
  const result = action === 'APPROVE'
    ? await OSPAccountCrudService.approveIOU(params.id)
    : await OSPAccountCrudService.rejectIOU(params.id, reason as string | undefined);
  return { message: `IOU ${action.toLowerCase()}d successfully`, data: result };
}, {
  schema: actionSchema,
  roles: ROLE_GROUPS.FINANCE_APPROVERS,
  audit: { action: 'APPROVE_IOU', entity: 'OSP_IOU' }
});
