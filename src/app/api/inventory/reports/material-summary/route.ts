export const dynamic = 'force-dynamic';

import { apiHandler } from '@/lib/api-handler';
import { MaterialSummaryReportService } from '@/services/inventory/material-summary-report.service';
import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { prisma } from '@/lib/prisma';
import { resolveOpmcScope } from '@/lib/opmc-scope';

export const GET = apiHandler(async (req: Request, params) => {
    const { searchParams } = new URL(req.url);

    const yearParam  = searchParams.get('year');
    const monthParam = searchParams.get('month');
    const rtom       = searchParams.get('rtom') ?? undefined;
    const itemCode   = searchParams.get('itemCode') ?? undefined;

    const year  = yearParam  ? parseInt(yearParam,  10) : undefined;
    const month = monthParam ? parseInt(monthParam, 10) : undefined;

    const opmcScope = await resolveOpmcScope(params._userId);
    const allowedRtoms = opmcScope === undefined
        ? undefined
        : (opmcScope.length === 0
            ? []
            : (await prisma.oPMC.findMany({
                where: { id: { in: opmcScope } },
                select: { rtom: true },
            })).map((opmc) => opmc.rtom));

    const report = await MaterialSummaryReportService.generate({
        year,
        month,
        rtom,
        itemCode,
        canViewCosts: params._permissions.includes(RBAC_PERMISSIONS.INVENTORY_COST_READ),
        allowedRtoms,
    });

    return Response.json({ success: true, data: report });
}, {
    permissions: [RBAC_PERMISSIONS.INVENTORY_READ],
    audit: { action: 'VIEW_MATERIAL_SUMMARY_REPORT', entity: 'InventoryReport' },
});

