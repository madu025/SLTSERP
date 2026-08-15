import { ROLE_GROUPS } from '@/config/roles';
import { apiHandler } from '@/lib/api-handler';
import { OSPAccountCrudService } from '@/services/finance/osp-account-crud.service';
import { z } from 'zod';
export const dynamic = 'force-dynamic';
const createSchema = z.object({
  refNumber: z.string().min(1, 'Reference Number is required'),
  type: z.string().optional(),
  supplierName: z.string().optional(),
  description: z.string().min(1, 'Description is required'),
  invoiceNo: z.string().optional(),
  amount: z.number().positive('Amount must be positive'),
  vatAmount: z.number().nonnegative().optional(),
  opmcId: z.string().optional(),
});
export const GET = apiHandler(async () => {
  const advances = await OSPAccountCrudService.getAdvances();
  return { data: advances };
}, {
  roles: ROLE_GROUPS.PROJECT_MANAGERS
});
export const POST = apiHandler(async (request) => {
  const body = await request.json();
  const data = createSchema.parse(body);
  const result = await OSPAccountCrudService.createAdvance(data);
  return { message: 'Project Advance created successfully', data: result };
}, {
  roles: ROLE_GROUPS.PROJECT_MANAGERS,
  audit: { action: 'CREATE', entity: 'OSP_ADVANCE' }
});