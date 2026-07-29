import { NextRequest } from 'next/server';
import { apiHandler } from '@/lib/api-handler';
import { FXService } from '@/services/finance/fx.service';
import { z } from 'zod';
import { ROLE_GROUPS } from "@/config/roles";

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async () => {
  const rates = await FXService.getAllLatestRates();
  return rates;
}, {
  roles: ROLE_GROUPS.FINANCE_APPROVERS
});

const updateRateSchema = z.object({
  currencyCode: z.string().min(3).max(3),
  exchangeRate: z.number().positive(),
  effectiveDate: z.string().optional()
});

export const POST = apiHandler(async (req: Request) => {
  const body = await req.json();
  const parsed = updateRateSchema.parse(body);
  
  const effectiveDate = parsed.effectiveDate ? new Date(parsed.effectiveDate) : new Date();
  const result = await FXService.setExchangeRate(parsed.currencyCode, parsed.exchangeRate, effectiveDate);
  
  return result;
}, {
  roles: ROLE_GROUPS.FINANCE_APPROVERS
});
