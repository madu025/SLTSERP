import { NextResponse } from 'next/server';
import { apiHandler } from '@/lib/api-handler';

import { OSPAccountCrudService } from '@/services/finance/osp-account-crud.service';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const createSchema = z.object({
  vehicleNo: z.string().optional(),
  bankCode: z.string().optional(),
  accountNo: z.string().optional(),
  accountName: z.string().min(1, 'Account Name is required'),
  amount: z.number().positive('Amount must be positive'),
  slipNo: z.string().min(1, 'Slip No is required'),
  slipDate: z.string().optional(),
  paidDate: z.string().optional(),
  opmcId: z.string().optional(),
});

export const GET = apiHandler(async () => {
  const payments = await OSPAccountCrudService.getHiringPayments();
  return { data: payments };
}, {
  roles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'OSP_MANAGER']
});

export const POST = apiHandler(async (request) => {
  const body = await request.json();
  const data = createSchema.parse(body);

  const sDate = data.slipDate ? new Date(data.slipDate) : new Date();
  const pDate = data.paidDate ? new Date(data.paidDate) : new Date();

  const result = await OSPAccountCrudService.createHiringPayment({
    ...data,
    slipDate: sDate,
    paidDate: pDate,
  });

  return { message: 'Hiring Payment created successfully', data: result };
}, {
  roles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'OSP_MANAGER']
});
