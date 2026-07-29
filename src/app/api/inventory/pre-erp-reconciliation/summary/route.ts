import { ROLE_GROUPS } from '@/config/roles';
import { apiHandler } from '@/lib/api-handler';
import { AppError } from '@/lib/error';
import { MaterialAuditReportService } from '@/services/inventory/material-audit-report.service';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (request) => {
  const { searchParams } = new URL(request.url);
  const opmcId = searchParams.get('opmcId') ?? undefined;

  return MaterialAuditReportService.getExecutiveAuditSummary(opmcId);
}, {
  roles: ROLE_GROUPS.FINANCE_APPROVERS,
  rawResponse: true,
});
