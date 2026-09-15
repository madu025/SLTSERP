import { apiHandler } from '@/lib/api-handler';
import { ReportService } from '@/services/core/report.service';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
  date: z.string().optional().nullable(),
  rtom: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
});

export const GET = apiHandler(async (request) => {
  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({
    date: searchParams.get('date'),
    rtom: searchParams.get('rtom'),
    category: searchParams.get('category'),
  });

  if (!parsed.success) {
    return { success: false, error: 'Invalid query parameters', details: parsed.error.format() };
  }

  const data = await ReportService.getDailyOperationalOrders({
    date: parsed.data.date,
    rtom: parsed.data.rtom,
    category: parsed.data.category,
  });
  return { success: true, data };
}, { menuPath: '/reports/daily-operational' });
