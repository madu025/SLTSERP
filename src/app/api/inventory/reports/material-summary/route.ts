export const dynamic = 'force-dynamic';

import { ROLE_GROUPS } from '@/config/roles';
import { apiHandler } from '@/lib/api-handler';
import { MaterialSummaryReportService } from '@/services/inventory/material-summary-report.service';

export const GET = apiHandler(async (req: Request) => {
    const { searchParams } = new URL(req.url);

    const yearParam  = searchParams.get('year');
    const monthParam = searchParams.get('month');
    const rtom       = searchParams.get('rtom') ?? undefined;
    const itemCode   = searchParams.get('itemCode') ?? undefined;

    const year  = yearParam  ? parseInt(yearParam,  10) : undefined;
    const month = monthParam ? parseInt(monthParam, 10) : undefined;

    const report = await MaterialSummaryReportService.generate({ year, month, rtom, itemCode });

    return Response.json({ success: true, data: report });
}, {
    roles: ROLE_GROUPS.PROJECT_MANAGERS,
    audit: { action: 'VIEW_MATERIAL_SUMMARY_REPORT', entity: 'InventoryReport' },
});
