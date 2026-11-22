import { apiHandler } from '@/lib/api-handler';
import { ReportService } from '@/services/core/report.service';
import { z } from 'zod';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { resolveReportScope } from '@/lib/report-scope';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
  date: z.string().optional().nullable(),
  rtom: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
});

export const GET = apiHandler(async (request, params) => {
  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({
    date: searchParams.get('date'),
    rtom: searchParams.get('rtom'),
    category: searchParams.get('category'),
  });

  if (!parsed.success) {
    return { success: false, error: 'Invalid query parameters', details: parsed.error.format() };
  }

  return await ReportService.getDailyOperationalOrders({
    date: parsed.data.date,
    rtom: parsed.data.rtom,
    category: parsed.data.category,
    // an Area Manager sees the orders of their own RTOMs only
    allowedRtoms: (await resolveReportScope(params._userId))?.rtomNames,
  });
}, { permissions: [RBAC_PERMISSIONS.REPORTS_READ] });
