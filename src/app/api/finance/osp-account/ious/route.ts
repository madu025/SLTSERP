import { ROLE_GROUPS } from '@/config/roles';
import { NextResponse } from 'next/server';
import { apiHandler } from '@/lib/api-handler';

import { OSPAccountCrudService } from '@/services/finance/osp-account-crud.service';
import { z } from 'zod';

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
  opmcId: z.string().optional(),
});

export const GET = apiHandler(async () => {
  const ious = await OSPAccountCrudService.getIOUs();
  return { data: ious };
}, {
  roles: ROLE_GROUPS.PROJECT_MANAGERS
});

export const POST = apiHandler(async (request) => {
  const body = await request.json();
  const data = createSchema.parse(body);

  const parsedDate = data.issuedDate ? new Date(data.issuedDate) : new Date();

  const result = await OSPAccountCrudService.createIOU({
    ...data,
    issuedDate: parsedDate,
  });

  return { message: 'IOU created successfully', data: result };
}, {
  roles: ROLE_GROUPS.PROJECT_MANAGERS,
  audit: { action: 'CREATE', entity: 'OSP_IOU' }
});
