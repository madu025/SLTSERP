import { apiHandler } from '@/lib/api-handler';
import { OspAccountReportService } from '@/services/finance/osp-account-report.service';

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async () => {
    const report = await OspAccountReportService.getDashboardReports();
    return report;
}, {
    roles: ['SUPER_ADMIN', 'ADMIN', 'FINANCE_MANAGER', 'OSP_MANAGER', 'AUDITOR']
});
