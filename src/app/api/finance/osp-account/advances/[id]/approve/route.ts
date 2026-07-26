import { NextResponse } from 'next/server';
import { apiHandler } from '@/lib/api-handler';
import { OSPAccountCrudService } from '@/services/finance/osp-account-crud.service';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const actionSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT']),
});

export const PATCH = apiHandler(async (request, { params }) => {
  const body = await request.json();
  const { action } = actionSchema.parse(body);

  let result;
  if (action === 'APPROVE') {
    result = await OSPAccountCrudService.approveAdvance(params.id);
  } else {
    result = await OSPAccountCrudService.rejectAdvance(params.id);
  }

  return { message: `Project Advance ${action.toLowerCase()}d successfully`, data: result };
}, {
  roles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER']
});
