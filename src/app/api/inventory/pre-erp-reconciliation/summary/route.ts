import { RBAC_PERMISSIONS } from '@/config/rbac-permissions';
import { apiHandler } from '@/lib/api-handler';
import { MaterialAuditReportService } from '@/services/inventory/material-audit-report.service';
export const dynamic = 'force-dynamic';
export const GET = apiHandler(async (request) => {
  const { searchParams } = new URL(request.url);
  const opmcId = searchParams.get('opmcId') ?? undefined;
  return MaterialAuditReportService.getExecutiveAuditSummary(opmcId);
}, {
  permissions: [RBAC_PERMISSIONS.INVENTORY_READ],
  rawResponse: true,
});
