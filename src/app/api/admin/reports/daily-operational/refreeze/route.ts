import { apiHandler } from '@/lib/api-handler';
import { ReportService } from '@/services/core/report.service';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const refreezeSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
});

export const POST = apiHandler(async (request) => {
  const body = await request.json().catch(() => ({}));
  const parsed = refreezeSchema.safeParse(body);

  if (!parsed.success) {
    return {
      success: false,
      error: 'Invalid payload. "date" string in YYYY-MM-DD format is required.',
      details: parsed.error.format(),
    };
  }

  const result = await ReportService.refreezeDailyReportSnapshot(parsed.data.date);
  return {
    success: true,
    message: `Daily report snapshot successfully refrozen for date ${parsed.data.date}`,
    ...result,
  };
}, {
  rawResponse: false,
  allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'OSP_MANAGER'],
  menuPath: '/reports/daily-operational',
});
