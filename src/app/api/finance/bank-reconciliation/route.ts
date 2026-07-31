export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { apiHandler } from '@/lib/api-handler';
import { BankReconciliationService } from '@/services/finance/bank-reconciliation.service';
import { z } from 'zod';
import { AppError } from '@/lib/error';
import { ROLE_GROUPS } from "@/config/roles";

const rowSchema = z.object({
  date: z.string(),
  description: z.string(),
  referenceNumber: z.string(),
  amount: z.number(),
});

const uploadSchema = z.object({
  rows: z.array(rowSchema)
});

export const POST = apiHandler(async (req: Request) => {
  const body = await req.json();
  const parsed = uploadSchema.safeParse(body);
  
  if (!parsed.success) {
    throw AppError.badRequest('Invalid statement rows format');
  }

  // Convert date strings to Date objects
  const mappedRows = parsed.data.rows.map(row => ({
    ...row,
    date: new Date(row.date)
  }));

  const result = await BankReconciliationService.autoReconcileStatement(mappedRows);
  return result;
}, {
  roles: ROLE_GROUPS.FINANCE_APPROVERS
});
