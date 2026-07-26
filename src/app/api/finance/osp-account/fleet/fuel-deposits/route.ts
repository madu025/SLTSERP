import { NextResponse } from 'next/server';
import { apiHandler } from '@/lib/api-handler';

import { OSPAccountCrudService } from '@/services/finance/osp-account-crud.service';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const createSchema = z.object({
  officeLocation: z.string().min(1, 'Office Location is required'),
  stationName: z.string().min(1, 'Station Name is required'),
  actualDeposit: z.number().positive('Deposit must be positive'),
  opmcId: z.string().optional(),
});

export const GET = apiHandler(async () => {
  const deposits = await OSPAccountCrudService.getFuelDeposits();
  return { data: deposits };
}, {
  roles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'OSP_MANAGER']
});

export const POST = apiHandler(async (request) => {
  const body = await request.json();
  const data = createSchema.parse(body);

  const result = await OSPAccountCrudService.createFuelDeposit(data);

  return { message: 'Fuel Deposit created successfully', data: result };
}, {
  roles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'OSP_MANAGER']
});
