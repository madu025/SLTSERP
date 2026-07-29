import { apiHandler } from '@/lib/api-handler';
import { LedgerReportService } from '@/services/finance/ledger-report.service';
import { ROLE_GROUPS } from "@/config/roles";

export const dynamic = 'force-dynamic';

export const GET = apiHandler(async (req) => {
    const { searchParams } = new URL(req.url);
    const asOfStr = searchParams.get('asOf');
    const asOfDate = asOfStr ? new Date(asOfStr) : undefined;

    const report = await LedgerReportService.getBalanceSheetReport(asOfDate);
    return report;
}, {
    roles: ROLE_GROUPS.FINANCE_ALL
});
