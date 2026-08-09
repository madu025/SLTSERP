import { ROLE_GROUPS } from '@/config/roles';
import { apiHandler } from '@/lib/api-handler';

import { OSPAccountCrudService } from '@/services/finance/osp-account-crud.service';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const createSchema = z.object({
  accountNo: z.string().optional(),
  supplierName: z.string().min(1, 'Supplier Name is required'),
  amount: z.number().positive('Amount must be positive'),
  category: z.string().optional(),
  slipNo: z.string().min(1, 'Slip No is required'),
  slipDate: z.string().optional(),
  opmcId: z.string().optional(),
});

export const GET = apiHandler(async () => {
  const rents = await OSPAccountCrudService.getRentPayments();
  return { data: rents };
}, {
  roles: ROLE_GROUPS.PROJECT_MANAGERS
});

export const POST = apiHandler(async (request) => {
  const body = await request.json();
  const data = createSchema.parse(body);

  const parsedDate = data.slipDate ? new Date(data.slipDate) : new Date();

  const result = await OSPAccountCrudService.createRentPayment({
    ...data,
    slipDate: parsedDate,
  });

  return { message: 'Rent Payment created successfully', data: result };
}, {
  roles: ROLE_GROUPS.PROJECT_MANAGERS,
  audit: { action: 'CREATE', entity: 'OSP_RENT' }
});
