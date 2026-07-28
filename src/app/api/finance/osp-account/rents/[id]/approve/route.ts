import { apiHandler } from '@/lib/api-handler';
import { OSPAccountCrudService } from '@/services/finance/osp-account-crud.service';
import { ROLE_GROUPS } from '@/config/roles';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const actionSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT']),
});

export const PATCH = apiHandler(async (_request, params, body) => {
  const { action } = body;
  const result = action === 'APPROVE'
    ? await OSPAccountCrudService.approveRentPayment(params.id)
    : await OSPAccountCrudService.rejectRentPayment(params.id);
  return { message: `Rent Payment ${action.toLowerCase()}d successfully`, data: result };
}, {
  schema: actionSchema,
  roles: ROLE_GROUPS.FINANCE_APPROVERS
});
