import { apiHandler } from '@/lib/api-handler';
import { OSPAccountCrudService } from '@/services/finance/osp-account-crud.service';
import { OspFloatService } from '@/services/finance/osp-float.service';
import { z } from 'zod';
import { databaseUuidSchema } from '@/lib/validations/uuid.schema';
export const dynamic = 'force-dynamic';
const createSchema = z.object({
  iouNumber: z.string().min(1, 'IOU Number is required'),
  staffName: z.string().min(1, 'Staff Name is required'),
  staffServiceNo: z.string().optional(),
  type: z.string().optional(),
  amount: z.number().positive('Amount must be positive'),
  issuedDate: z.string().optional(),
  reason: z.string().optional(),
  noOfDays: z.number().nonnegative().optional(),
  remarks: z.string().optional(),
  siteOfficeId: databaseUuidSchema.optional(),
  floatId: databaseUuidSchema.optional(),
});
export const GET = apiHandler(async (_request, params) => {
  const ious = await OspFloatService.listIous(params._userId as string);
  return { data: ious };
}, {
});
export const POST = apiHandler(async (request, params) => {
  const body = await request.json();
  const data = createSchema.parse(body);
  if (data.siteOfficeId) await OspFloatService.assertSiteOfficeInScope(params._userId as string, data.siteOfficeId);
  const parsedDate = data.issuedDate ? new Date(data.issuedDate) : new Date();
  const result = await OSPAccountCrudService.createIOU({
    ...data,
    issuedDate: parsedDate,
  }, params._userId);
  return { message: 'IOU created successfully', data: result };
}, {
  audit: { action: 'CREATE', entity: 'OSP_IOU' }
});