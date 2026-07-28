import { ROLE_GROUPS } from '@/config/roles';
import { NextResponse } from 'next/server';
import { apiHandler } from '@/lib/api-handler';
import { OSPAccountCrudService } from '@/services/finance/osp-account-crud.service';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const actionSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT']),
});

export const PATCH = apiHandler(async (_request, params, body) => {
  const { action } = body;
  const result = action === 'APPROVE'
    ? await OSPAccountCrudService.approveFuelDeposit(params.id)
    : await OSPAccountCrudService.rejectFuelDeposit(params.id);
  return { message: `Fuel Deposit ${action.toLowerCase()}d successfully`, data: result };
}, {
  schema: actionSchema,
  roles: ROLE_GROUPS.FINANCE_APPROVERS
});
