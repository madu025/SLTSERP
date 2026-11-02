import { apiHandler } from '@/lib/api-handler';
import { FXService } from '@/services/finance/fx.service';
import { z } from 'zod';
export const dynamic = 'force-dynamic';
export const GET = apiHandler(async () => {
  const rates = await FXService.getAllLatestRates();
  return rates;
}, {
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
  audit: { action: 'UPDATE', entity: 'EXCHANGE_RATE' }
});